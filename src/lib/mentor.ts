import 'server-only';
import { randomInt } from 'node:crypto';
import { db } from './db';
import { ApiError, limit } from './auth';
import { lessonById } from './mentor-catalog';
import { makeProblem } from './mentor-problems';
import { guideFor, publicGuide } from './mentor-guides';

export async function startMentor(pid: string, lesson: string, mode: 'learn' | 'speed' | 'exam') {
  if (!lessonById.has(lesson)) throw new ApiError(400, 'اختر مهارة متاحة.');
  await limit('mentor-start:' + pid, 40);
  return db().begin(async (tx) => {
    const [batch] =
      await tx`INSERT INTO mentor_batches(participant_id,mode,deadline) VALUES(${pid},${mode},CASE WHEN ${mode}='exam' THEN now()+interval '6 minutes' ELSE NULL END) RETURNING id`;
    const mixed = ['triangle', 'ratio', 'analogy', 'circle', 'fractions', 'reading'];
    const count = mode === 'exam' ? 6 : 3;
    for (let i = 0; i < count; i++)
      await tx`INSERT INTO mentor_activities(participant_id,lesson,seed,variant,mode,batch_id,position) VALUES(${pid},${mode === 'exam' ? mixed[i] : lesson},${randomInt(1000000)},${i % 3},${mode},${batch.id},${i})`;
    return { id: batch.id };
  });
}
export async function mentorState(pid: string, id: string, position?: number) {
  const [b] = await db()`SELECT * FROM mentor_batches WHERE id=${id} AND participant_id=${pid}`;
  if (!b) throw new ApiError(404, 'لم نجد جلسة التدريب.');
  if (!b.completed_at && b.deadline && new Date(b.deadline).getTime() <= Date.now()) {
    await finishMentor(pid, id);
    b.completed_at = new Date();
  }
  const rows =
    await db()`SELECT a.*,t.correct,t.assisted,t.elapsed_ms FROM mentor_activities a LEFT JOIN mentor_attempts t ON t.activity_id=a.id::text AND t.participant_id=a.participant_id WHERE a.batch_id=${id} ORDER BY a.position`;
  const finished = Boolean(b.completed_at);
  const timed = b.mode === 'exam';
  const next =
    timed && position !== undefined
      ? rows.find((a) => a.position === position)
      : rows.find((a) => (timed ? a.first_choice === null : !a.resolved));
  const show = (a: (typeof rows)[number], reveal: boolean) => {
    const p = makeProblem(a.lesson, a.seed, a.variant),
      meta = lessonById.get(a.lesson)!;
    return {
      id: a.id,
      lesson: a.lesson,
      name: meta.name,
      prompt: p.prompt,
      choices: p.choices,
      unit: p.unit,
      diagram: p.diagram,
      passage: p.passage,
      hints: a.hint_count,
      chosen: a.last_choice,
      firstChosen: a.first_choice,
      flagged: a.flagged,
      guide:
        !timed && a.hint_count
          ? publicGuide(guideFor(a.lesson, a.seed, a.variant), a.guide_step)
          : null,
      firstCorrect: a.correct,
      assisted: a.assisted,
      resolved: a.resolved,
      elapsedMs: a.elapsed_ms ?? 0,
      ...(reveal
        ? { answer: p.answer, steps: p.steps, fast: meta.fast, condition: meta.condition }
        : {}),
      ...(!timed && a.hint_count
        ? {
            hint:
              a.guide_step >= guideFor(a.lesson, a.seed, a.variant).length
                ? 'استخدم العلاقة التي توصلت إليها، ثم جرّب إجابة السؤال.'
                : 'نحدد موضع التعثر خطوة بخطوة.',
          }
        : {}),
      ...(timed && !finished ? { firstCorrect: undefined, assisted: undefined } : {}),
    };
  };
  return {
    id,
    mode: b.mode,
    total: rows.length,
    index: next ? next.position : rows.length,
    finished,
    deadline: b.deadline ? new Date(b.deadline).toISOString() : null,
    createdAt: new Date(b.created_at).toISOString(),
    navigation: timed
      ? rows.map((a) => ({
          id: a.id,
          position: a.position,
          answered: a.last_choice !== null && a.last_choice >= 0,
          flagged: a.flagged,
        }))
      : undefined,
    question: next ? show(next, false) : null,
    score: finished ? rows.filter((a) => a.correct).length : undefined,
    results: finished ? rows.map((a) => show(a, true)) : undefined,
    current:
      !timed && !finished
        ? rows.find((a) => a.position === (next?.position ?? rows.length) - 1)?.id
        : undefined,
  };
}
export async function answerMentor(
  pid: string,
  id: string,
  choice: number,
  elapsedMs: number,
  reveal = false,
) {
  return db().begin(async (tx) => {
    const [a] =
      await tx`SELECT a.*,b.completed_at,b.deadline FROM mentor_activities a JOIN mentor_batches b ON b.id=a.batch_id WHERE a.id=${id} AND a.participant_id=${pid} FOR UPDATE OF a,b`;
    if (!a) throw new ApiError(404, 'السؤال غير موجود.');
    if (a.completed_at || (a.deadline && new Date(a.deadline).getTime() <= Date.now()))
      throw new ApiError(409, 'انتهى وقت الجلسة. اعرض النتيجة.');
    if (a.mode === 'exam' && reveal)
      throw new ApiError(403, 'الشرح متاح بعد تسليم التدريب المؤقّت.');
    const p = makeProblem(a.lesson, a.seed, a.variant);
    if (a.mode === 'exam') {
      // Exam choices are drafts until submission. Keep the first choice for
      // review, but grade the final saved answer and never reveal it in-flight.
      await tx`INSERT INTO mentor_attempts(participant_id,activity_id,skill,correct,assisted,elapsed_ms) VALUES(${pid},${id},${a.lesson},${choice === p.answer},false,${elapsedMs}) ON CONFLICT(participant_id,activity_id) DO UPDATE SET correct=EXCLUDED.correct,elapsed_ms=GREATEST(mentor_attempts.elapsed_ms,EXCLUDED.elapsed_ms)`;
      await tx`UPDATE mentor_activities SET first_choice=COALESCE(first_choice,${choice}),last_choice=${choice},resolved=true WHERE id=${id}`;
      return { saved: true, batchId: a.batch_id };
    }
    if (a.resolved)
      return {
        saved: true,
        batchId: a.batch_id,
        ...(a.mode !== 'exam'
          ? {
              correct: a.last_choice === p.answer,
              resolved: true,
              answer: p.answer,
              steps: p.steps,
            }
          : {}),
      };
    if (reveal && a.first_choice === null)
      throw new ApiError(409, 'جرّب اختيارًا أو اضغط لا أعرف أولًا.');
    const correct = !reveal && choice === p.answer;
    const assisted = a.hint_count > 0 || reveal;
    const resolved = a.mode === 'exam' || correct || reveal;
    await tx`INSERT INTO mentor_attempts(participant_id,activity_id,skill,correct,assisted,elapsed_ms) VALUES(${pid},${id},${a.lesson},${correct},${assisted},${elapsedMs}) ON CONFLICT DO NOTHING`;
    await tx`UPDATE mentor_activities SET first_choice=COALESCE(first_choice,${choice}),last_choice=${choice},resolved=${resolved} WHERE id=${id}`;
    if (!a.mode || a.mode !== 'exam') {
      const pending =
        await tx`SELECT id FROM mentor_activities WHERE batch_id=${a.batch_id} AND resolved=false LIMIT 1`;
      if (!pending.length)
        await tx`UPDATE mentor_batches SET completed_at=now() WHERE id=${a.batch_id}`;
    }
    return {
      saved: true,
      batchId: a.batch_id,
      ...(a.mode === 'exam'
        ? {}
        : {
            correct,
            resolved,
            hint: p.hint,
            ...(resolved ? { answer: p.answer, steps: p.steps } : {}),
          }),
    };
  });
}
export async function hintMentor(pid: string, id: string) {
  const [a] =
    await db()`UPDATE mentor_activities a SET hint_count=hint_count+1 FROM mentor_batches b WHERE a.id=${id} AND a.participant_id=${pid} AND a.batch_id=b.id AND b.completed_at IS NULL AND a.mode<>'exam' AND a.resolved=false RETURNING a.*`;
  if (!a) throw new ApiError(409, 'التلميحات غير متاحة لهذا السؤال الآن.');
  return {
    hint: 'أجب عن هذه الخطوة لنحدد ما تحتاجه قبل إعادة المحاولة.',
    guide: publicGuide(guideFor(a.lesson, a.seed, a.variant), a.guide_step),
  };
}
export async function answerGuide(pid: string, id: string, index: number, choice: number) {
  return db().begin(async (tx) => {
    const [a] =
      await tx`SELECT a.*,b.completed_at FROM mentor_activities a JOIN mentor_batches b ON b.id=a.batch_id WHERE a.id=${id} AND a.participant_id=${pid} FOR UPDATE OF a,b`;
    if (
      !a ||
      a.completed_at ||
      a.mode === 'exam' ||
      a.resolved ||
      !a.hint_count ||
      a.guide_step !== index
    )
      throw new ApiError(409, 'حدّث السؤال قبل متابعة التلميح.');
    const steps = guideFor(a.lesson, a.seed, a.variant),
      step = steps[index];
    if (!step) throw new ApiError(409, 'اكتملت الخطوات؛ جرّب إجابة السؤال.');
    const correct = step.answer === choice;
    if (correct) await tx`UPDATE mentor_activities SET guide_step=guide_step+1 WHERE id=${id}`;
    const guide = publicGuide(steps, index + (correct ? 1 : 0));
    return {
      guide,
      hint: correct
        ? guide
          ? 'صحيح، لننتقل إلى العلاقة التالية.'
          : 'صحيح. استخدم ما توصلت إليه لحل السؤال الأصلي.'
        : step.hint,
    };
  });
}
export async function flagMentor(pid: string, id: string, flagged: boolean) {
  return db().begin(async (tx) => {
    const [a] =
      await tx`SELECT a.id,b.completed_at,b.deadline FROM mentor_activities a JOIN mentor_batches b ON b.id=a.batch_id WHERE a.id=${id} AND a.participant_id=${pid} AND a.mode='exam' FOR UPDATE OF a,b`;
    if (!a || a.completed_at || new Date(a.deadline).getTime() <= Date.now())
      throw new ApiError(409, 'انتهى التدريب؛ العلامات متاحة أثناء الحل.');
    await tx`UPDATE mentor_activities SET flagged=${flagged} WHERE id=${id}`;
    return { ok: true };
  });
}
export async function finishMentor(pid: string, id: string) {
  const result =
    await db()`UPDATE mentor_batches SET completed_at=COALESCE(completed_at,now()) WHERE id=${id} AND participant_id=${pid} RETURNING id`;
  if (!result.length) throw new ApiError(404, 'الجلسة غير موجودة.');
  return { ok: true };
}
