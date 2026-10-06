import 'server-only';
import { db } from './db';
import { ApiError } from './auth';
import { questionMap, questions, publicQuestion } from './content';
import { postEligible, postOpensAt } from './rules';
import type { Kind, Overview, StudyState } from './types';
import { choiceOrder } from './choice-order';
import { adaptiveProfile } from './adaptive';
import { lessons } from './mentor-catalog';

export async function sessionState(id: string, participantId: string): Promise<StudyState> {
  const [s] =
    await db()`SELECT * FROM study_sessions WHERE id=${id} AND participant_id=${participantId}`;
  if (!s) throw new ApiError(404, 'الجلسة غير موجودة.');
  const attempts = await db()`SELECT question_id,resolved_at FROM attempts WHERE session_id=${id}`;
  const done = new Set(attempts.filter((a) => a.resolved_at).map((a) => a.question_id));
  const qid = (s.question_ids as string[]).find((q) => !done.has(q));
  const q = qid ? questionMap.get(qid) : null;
  const hints = q
    ? await db()`SELECT stage,text,highlight,source FROM hint_events WHERE session_id=${id} AND question_id=${q.id} AND source<>'pending' ORDER BY stage`
    : [];
  return {
    id: s.id,
    kind: s.kind,
    index: done.size,
    total: s.question_ids.length,
    completed: Boolean(s.completed_at),
    score: s.completed_at ? s.score : null,
    question: q
      ? {
          ...publicQuestion(q),
          choices: choiceOrder(s.id, q.id, s.shuffle_choices).map((i) => q.choices[i]),
        }
      : null,
    hints: hints.map((h) => ({
      text: h.text,
      highlight: h.highlight,
      stage: h.stage,
      source: h.source,
    })),
  };
}
export async function startSession(participantId: string, kind: Kind, skill?: string) {
  const sql = db();
  return sql.begin(async (tx) => {
    const [p] = await tx`SELECT * FROM participants WHERE id=${participantId} FOR UPDATE`;
    if (!p) throw new ApiError(401, 'انتهت الجلسة.');
    if (skill && !questions.some((q) => q.skillId === skill))
      throw new ApiError(400, 'المهارة غير متاحة.');
    const existing =
      await tx`SELECT id,completed_at FROM study_sessions WHERE participant_id=${participantId} AND kind=${kind} AND (kind<>'practice' OR skill=${skill ?? 'general'}) ORDER BY started_at DESC LIMIT 1`;
    if (existing[0] && (!existing[0].completed_at || kind !== 'practice'))
      return existing[0].id as string;
    if (kind !== 'pre') {
      const pre =
        await tx`SELECT id FROM study_sessions WHERE participant_id=${participantId} AND kind='pre' AND completed_at IS NOT NULL`;
      if (!pre.length) throw new ApiError(409, 'أكمل الاختبار القبلي أولًا.');
    }
    if (kind === 'post' && !postEligible(p.created_at))
      throw new ApiError(409, 'يتاح الاختبار البعدي بعد 14 يومًا من دخولك.');
    let ids = questions.filter((q) => q.split === kind).map((q) => q.id);
    if (kind === 'practice') {
      const counts =
        await tx`SELECT question_id,count(*)::int AS n FROM attempts WHERE participant_id=${participantId} GROUP BY question_id`;
      const map = new Map(counts.map((c) => [c.question_id, c.n]));
      ids = ids
        .filter((id) => !skill || questionMap.get(id)?.skillId === skill)
        .sort((a, b) => (map.get(a) ?? 0) - (map.get(b) ?? 0) || a.localeCompare(b))
        .slice(0, 5);
      if (ids.length !== 5) throw new ApiError(400, 'المهارة المطلوبة غير متاحة.');
    }
    const [s] =
      await tx`INSERT INTO study_sessions(participant_id,kind,question_ids,skill,shuffle_choices) VALUES(${participantId},${kind},${tx.array(ids)},${skill ?? 'general'},true) RETURNING id`;
    await tx`INSERT INTO events(participant_id,name,value) VALUES(${participantId},'session_started',${kind})`;
    return s.id as string;
  });
}
export async function answerQuestion(
  participantId: string,
  id: string,
  qid: string,
  choice: number | null,
  elapsed: number,
  reveal = false,
) {
  return db().begin(async (tx) => {
    const [s] =
      await tx`SELECT * FROM study_sessions WHERE id=${id} AND participant_id=${participantId} FOR UPDATE`;
    if (!s) throw new ApiError(404, 'الجلسة غير موجودة.');
    const q = questionMap.get(qid);
    if (!q || !s.question_ids.includes(qid)) throw new ApiError(400, 'سؤال غير صالح لهذه الجلسة.');
    const order = choiceOrder(s.id, qid, s.shuffle_choices);
    if (choice !== null) {
      if (!Number.isInteger(choice) || choice < 0 || choice > 3)
        throw new ApiError(400, 'اختر إجابة صالحة.');
      choice = order[choice];
    }
    const attempts = await tx`SELECT * FROM attempts WHERE session_id=${id}`;
    const prior = attempts.find((a) => a.question_id === qid);
    const feedback = (correct: boolean, resolved: boolean) => ({
      correct,
      resolved,
      feedback:
        s.kind === 'practice'
          ? correct
            ? 'أحسنت، الفكرة صحيحة.'
            : q.feedback[choice ?? prior?.last_choice ?? 0]
          : null,
      ...(resolved && s.kind === 'practice'
        ? { answerIndex: order.indexOf(q.answerIndex), steps: q.steps }
        : {}),
      assessment: s.kind !== 'practice',
    });
    if (prior?.resolved_at)
      return s.kind === 'practice'
        ? { ...feedback(prior.last_choice === q.answerIndex, true), duplicate: true }
        : { resolved: true, assessment: true, duplicate: true };
    const done = new Set(attempts.filter((a) => a.resolved_at).map((a) => a.question_id));
    const next = (s.question_ids as string[]).find((x) => !done.has(x));
    if (s.completed_at || qid !== next) throw new ApiError(409, 'أجب عن السؤال الحالي أولًا.');
    if (reveal && (s.kind !== 'practice' || !prior))
      throw new ApiError(400, 'جرّب الإجابة أولًا قبل عرض الحل.');
    if (!reveal && (choice === null || !Number.isInteger(choice) || choice < 0 || choice > 3))
      throw new ApiError(400, 'اختر إجابة صالحة.');
    const correct = !reveal && choice === q.answerIndex;
    const resolved = s.kind !== 'practice' || correct || reveal;
    if (!prior) {
      await tx`INSERT INTO attempts(session_id,participant_id,question_id,choice,last_choice,correct,elapsed_ms,resolved_at) VALUES(${id},${participantId},${qid},${choice!},${choice!},${correct},${elapsed},${resolved ? new Date() : null})`;
    } else {
      await tx`UPDATE attempts SET last_choice=${choice ?? prior.last_choice},try_count=try_count+${reveal ? 0 : 1},resolved_at=${resolved ? new Date() : null} WHERE id=${prior.id}`;
    }
    if (resolved && done.size + 1 === s.question_ids.length) {
      await tx`UPDATE study_sessions SET completed_at=now(),score=(SELECT count(*) FROM attempts WHERE session_id=${id} AND correct)::int WHERE id=${id}`;
      await tx`INSERT INTO events(participant_id,name,value) VALUES(${participantId},'session_completed',${s.kind})`;
    }
    // Assessments never return correctness or the answer key before completion.
    if (s.kind !== 'practice') return { resolved: true, assessment: true };
    return feedback(correct, resolved);
  });
}
export async function overview(participantId: string): Promise<Overview> {
  const sql = db();
  const [[p], sessions, evidence, mentorRows, mentorSessions] = await Promise.all([
    sql`SELECT id,created_at FROM participants WHERE id=${participantId}`,
    sql`SELECT * FROM study_sessions WHERE participant_id=${participantId} ORDER BY started_at DESC`,
    sql`SELECT a.question_id,a.correct,a.created_at,s.kind,EXISTS(SELECT 1 FROM hint_events h WHERE h.session_id=a.session_id AND h.question_id=a.question_id AND h.created_at<=a.created_at) AS assisted FROM attempts a JOIN study_sessions s ON s.id=a.session_id WHERE a.participant_id=${participantId} AND (s.kind='practice' OR s.completed_at IS NOT NULL)`,
    sql`SELECT a.*,m.lesson,m.variant,m.seed,m.content_set FROM mentor_attempts a JOIN mentor_activities m ON m.id::text=a.activity_id JOIN mentor_batches b ON b.id=m.batch_id WHERE a.participant_id=${participantId} AND (m.mode<>'exam' OR b.completed_at IS NOT NULL)`,
    sql`SELECT b.id,b.mode,b.completed_at,min(m.lesson) AS lesson,count(m.id)::int AS total,count(t.activity_id) FILTER(WHERE t.correct)::int AS score FROM mentor_batches b JOIN mentor_activities m ON m.batch_id=b.id LEFT JOIN mentor_attempts t ON t.activity_id=m.id::text AND t.participant_id=b.participant_id WHERE b.participant_id=${participantId} AND b.completed_at IS NOT NULL GROUP BY b.id`,
  ]);
  const completed = sessions.filter((s) => s.completed_at),
    pre = completed.find((s) => s.kind === 'pre'),
    post = completed.find((s) => s.kind === 'post');
  const skills = lessons.map((l) => ({ id: l.id, name: l.name, answered: 0, correct: 0 }));
  const allRows = [
    ...evidence.map((e) => ({
      correct: Boolean(e.correct),
      skill: questionMap.get(e.question_id)?.skillId,
    })),
    ...mentorRows,
  ];
  for (const row of allRows) {
    const id = row.skill;
    const s = skills.find((s) => s.id === id);
    if (s) {
      s.answered++;
      if (row.correct) s.correct++;
    }
  }
  const practiced = completed.filter((s) => s.kind === 'practice');
  return {
    participant: { id: p.id, joinedAt: new Date(p.created_at).toISOString() },
    completedQuestions: allRows.length,
    accuracy: allRows.length
      ? Math.round((allRows.filter((r) => r.correct).length / allRows.length) * 100)
      : 0,
    practiceSessions: practiced.length + mentorSessions.length,
    completedSessions: completed.length + mentorSessions.length,
    pre: pre ? { score: pre.score, total: pre.question_ids.length } : null,
    post: post ? { score: post.score, total: post.question_ids.length } : null,
    postOpensAt: postOpensAt(p.created_at).toISOString(),
    postEligible: postEligible(p.created_at),
    activeSession: sessions.find((s) => !s.completed_at)?.id ?? null,
    activeSessions: sessions
      .filter((s) => !s.completed_at)
      .map((s) => ({ id: s.id, kind: s.kind, skill: s.skill })),
    adaptive: adaptiveProfile([
      ...mentorRows.map((e) => ({
        skill: e.skill,
        question: `${e.lesson}:${e.variant}:${['analogy', 'reading'].includes(e.lesson) ? e.content_set : e.seed % 7}`,
        correct: e.correct,
        assisted: e.assisted,
        kind: 'practice',
        date: new Date(e.created_at).toISOString(),
      })),
      ...evidence.map((e) => ({
        skill: questionMap.get(e.question_id)?.skillId ?? '',
        question: e.question_id,
        correct: e.correct,
        assisted: e.assisted,
        kind: e.kind,
        date: new Date(e.created_at).toISOString(),
      })),
    ]),
    recent: [
      ...completed.map((s) => ({
        id: s.id,
        kind: s.kind,
        label:
          s.kind === 'pre'
            ? 'الاختبار القبلي'
            : s.kind === 'post'
              ? 'الاختبار البعدي'
              : 'جلسة تدريب',
        href: '/review/' + s.id,
        score: s.score,
        total: s.question_ids.length,
        completedAt: new Date(s.completed_at).toISOString(),
      })),
      ...mentorSessions.map((s) => ({
        id: s.id,
        kind: 'practice' as const,
        label:
          s.mode === 'exam'
            ? 'تدريب مؤقّت'
            : (lessons.find((l) => l.id === s.lesson)?.name ?? 'تدريب المهارة'),
        href: `${s.mode === 'learn' ? '/mentor' : '/challenge'}?skill=${s.lesson}&mode=${s.mode}&batch=${s.id}&view=practice`,
        score: s.score,
        total: s.total,
        completedAt: new Date(s.completed_at).toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, 6),
    skills,
    offer: {
      enabled: Boolean(process.env.PRAXIS_CHECKOUT_URL && process.env.PRAXIS_OFFER_DESCRIPTION),
      description: process.env.PRAXIS_OFFER_DESCRIPTION ?? '',
      eligible: practiced.length > 0,
    },
  };
}

export async function reviewSession(id: string, participantId: string) {
  const [s] =
    await db()`SELECT * FROM study_sessions WHERE id=${id} AND participant_id=${participantId}`;
  if (!s || s.kind !== 'practice' || !s.completed_at)
    throw new ApiError(404, 'المراجعة متاحة لجلسات التدريب المكتملة.');
  const rows = await db()`SELECT * FROM attempts WHERE session_id=${id}`;
  return {
    id,
    score: s.score,
    total: s.question_ids.length,
    questions: s.question_ids.map((qid: string) => {
      const q = questionMap.get(qid)!;
      const a = rows.find((a) => a.question_id === qid);
      return {
        ...publicQuestion(q),
        answer: q.choices[q.answerIndex],
        chosen: a ? q.choices[a.choice] : null,
        correct: Boolean(a?.correct),
        steps: q.steps,
        elapsedMs: a?.elapsed_ms ?? 0,
      };
    }),
  };
}
