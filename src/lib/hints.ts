import 'server-only';
import { db } from './db';
import { ApiError } from './auth';
import { questionMap } from './content';
import { modelHint } from './model.mjs';
import { choiceOrder } from './choice-order';

export async function requestHint(
  participantId: string,
  sessionId: string,
  questionId: string,
  stage: number,
  choice: number | null,
) {
  const q = questionMap.get(questionId);
  if (!q) throw new ApiError(404, 'السؤال غير موجود.');
  const authored = q.hints[stage - 1];
  const prepared = await db().begin(async (tx) => {
    const [s] =
      await tx`SELECT * FROM study_sessions WHERE id=${sessionId} AND participant_id=${participantId} FOR UPDATE`;
    if (!s || s.kind !== 'practice' || s.completed_at)
      throw new ApiError(403, 'التلميحات متاحة داخل جلسة التدريب فقط.');
    if (choice !== null) choice = choiceOrder(s.id, questionId, s.shuffle_choices)[choice];
    const completed =
      await tx`SELECT question_id FROM attempts WHERE session_id=${sessionId} AND resolved_at IS NOT NULL`;
    const done = new Set(completed.map((a) => a.question_id));
    if ((s.question_ids as string[]).find((id) => !done.has(id)) !== questionId)
      throw new ApiError(409, 'اطلب تلميحًا للسؤال الحالي.');
    const existing =
      await tx`SELECT * FROM hint_events WHERE session_id=${sessionId} AND question_id=${questionId} ORDER BY stage`;
    const same = existing.find((h) => h.stage === stage);
    if (same) {
      if (same.source === 'pending') throw new ApiError(409, 'يجري تجهيز التلميح. حاول بعد لحظة.');
      return { existing: same, model: false };
    }
    if (stage !== existing.length + 1) throw new ApiError(409, 'ابدأ بالتلميح الأول.');
    let useModel = Boolean(process.env.PRAXIS_AI_API_KEY && process.env.PRAXIS_AI_MODEL);
    if (useModel) {
      await tx`SELECT pg_advisory_xact_lock(715201)`;
      const [usage] =
        await tx`SELECT count(*)::int n FROM hint_events WHERE source IN ('model','pending','fallback') AND created_at>=date_trunc('day',now())`;
      const cap = Math.max(
        1,
        Math.min(1000, Number(process.env.PRAXIS_AI_DAILY_REQUEST_LIMIT) || 100),
      );
      useModel = usage.n < cap;
    }
    const text =
      choice !== null && choice !== q.answerIndex && stage === 1
        ? `${q.feedback[choice]} ${authored.text}`
        : authored.text;
    const [record] =
      await tx`INSERT INTO hint_events(session_id,participant_id,question_id,stage,choice,source,text,highlight)
   VALUES(${sessionId},${participantId},${questionId},${stage},${choice},${useModel ? 'pending' : 'authored'},${useModel ? '' : text},${authored.highlight}) RETURNING *`;
    return { existing: record, model: useModel, fallback: text };
  });
  if (!prepared.model)
    return {
      text: prepared.existing.text,
      highlight: prepared.existing.highlight,
      stage,
      source: prepared.existing.source,
    };
  try {
    const result = await modelHint(q, choice, stage);
    await db()`UPDATE hint_events SET source='model',text=${result.text},highlight=${result.highlight},input_tokens=${result.inputTokens},output_tokens=${result.outputTokens} WHERE id=${prepared.existing.id}`;
    return { text: result.text, highlight: result.highlight, stage, source: 'model' };
  } catch {
    await db()`UPDATE hint_events SET source='fallback',text=${prepared.fallback!},highlight=${authored.highlight} WHERE id=${prepared.existing.id}`;
    return { text: prepared.fallback!, highlight: authored.highlight, stage, source: 'fallback' };
  }
}
