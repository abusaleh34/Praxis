import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, requireParticipant, sameOrigin, limit } from '@/lib/auth';
import {
  startMentor,
  mentorState,
  answerMentor,
  hintMentor,
  finishMentor,
  answerGuide,
  flagMentor,
  saveMentorTime,
} from '@/lib/mentor';
import { readiness } from '@/lib/readiness';
import { db } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const send = (d: unknown, status = 200) =>
  NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(req: NextRequest) {
  try {
    const p = await requireParticipant();
    if (req.method === 'GET') {
      const id = req.nextUrl.searchParams.get('id');
      if (id) {
        const index = req.nextUrl.searchParams.get('position');
        return send(
          await mentorState(
            p.id,
            z.string().uuid().parse(id),
            index === null ? undefined : z.coerce.number().int().min(0).max(5).parse(index),
          ),
        );
      }
      const sessions =
        await db()`SELECT b.id,b.mode,b.created_at,b.completed_at,b.deadline,min(a.lesson) AS lesson,count(a.id)::int AS total,count(a.id) FILTER(WHERE a.resolved)::int AS done FROM mentor_batches b JOIN mentor_activities a ON a.batch_id=b.id WHERE b.participant_id=${p.id} GROUP BY b.id ORDER BY b.created_at DESC LIMIT 12`;
      return send({
        sessions,
        vision: Boolean(process.env.PRAXIS_AI_API_KEY && process.env.PRAXIS_AI_MODEL),
      });
    }
    sameOrigin(req);
    if (process.env.PRAXIS_MODE === 'waitlist') throw new ApiError(403, 'التدريب لم يفتح بعد.');
    if (process.env.PRAXIS_MODE === 'pilot' && !(await readiness()).ready)
      throw new ApiError(503, 'التجربة متوقفة للمراجعة.');
    const text = await req.text();
    if (text.length > 3000) throw new ApiError(413, 'الطلب كبير.');
    const d = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('start'),
          lesson: z.string(),
          mode: z.enum(['learn', 'speed', 'exam']),
        }),
        z.object({
          action: z.literal('answer'),
          id: z.string().uuid(),
          choice: z.number().int().min(-1).max(3),
          elapsedMs: z.number().int().min(0).max(3600000),
          reveal: z.boolean().default(false),
        }),
        z.object({
          action: z.literal('time'),
          id: z.string().uuid(),
          elapsedMs: z.number().int().min(0).max(3600000),
        }),
        z.object({ action: z.literal('hint'), id: z.string().uuid() }),
        z.object({
          action: z.literal('guide'),
          id: z.string().uuid(),
          index: z.number().int().min(0).max(5),
          choice: z.number().int().min(0).max(3),
        }),
        z.object({ action: z.literal('flag'), id: z.string().uuid(), flagged: z.boolean() }),
        z.object({ action: z.literal('finish'), id: z.string().uuid() }),
      ])
      .parse(JSON.parse(text));
    // Background time saves must not consume the student's answer/hint allowance.
    await limit(
      (d.action === 'time' ? 'mentor-time:' : 'mentor-action:') + p.id,
      d.action === 'time' ? 1200 : 600,
    );
    if (d.action === 'start') return send(await startMentor(p.id, d.lesson, d.mode));
    if (d.action === 'answer')
      return send(await answerMentor(p.id, d.id, d.choice, d.elapsedMs, d.reveal));
    if (d.action === 'time') return send(await saveMentorTime(p.id, d.id, d.elapsedMs));
    if (d.action === 'hint') return send(await hintMentor(p.id, d.id));
    if (d.action === 'guide') return send(await answerGuide(p.id, d.id, d.index, d.choice));
    if (d.action === 'flag') return send(await flagMentor(p.id, d.id, d.flagged));
    return send(await finishMentor(p.id, d.id));
  } catch (e) {
    return send(
      { error: e instanceof ApiError ? e.message : 'تعذر تنفيذ الطلب. حاول مجددًا.' },
      e instanceof ApiError ? e.status : 400,
    );
  }
}
export { handle as GET, handle as POST };
