import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, requireParticipant, sameOrigin, limit } from '@/lib/auth';
import { startMentor, mentorState, answerMentor, hintMentor, finishMentor } from '@/lib/mentor';
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
      if (id) return send(await mentorState(p.id, z.string().uuid().parse(id)));
      const sessions =
        await db()`SELECT id,mode,created_at,completed_at FROM mentor_batches WHERE participant_id=${p.id} ORDER BY created_at DESC LIMIT 12`;
      return send({
        sessions,
        vision: Boolean(process.env.PRAXIS_AI_API_KEY && process.env.PRAXIS_AI_MODEL),
      });
    }
    sameOrigin(req);
    if (process.env.PRAXIS_MODE === 'waitlist') throw new ApiError(403, 'التدريب لم يفتح بعد.');
    if (process.env.PRAXIS_MODE === 'pilot' && !(await readiness()).ready)
      throw new ApiError(503, 'التجربة متوقفة للمراجعة.');
    await limit('mentor-action:' + p.id, 600);
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
        z.object({ action: z.literal('hint'), id: z.string().uuid() }),
        z.object({ action: z.literal('finish'), id: z.string().uuid() }),
      ])
      .parse(JSON.parse(text));
    if (d.action === 'start') return send(await startMentor(p.id, d.lesson, d.mode));
    if (d.action === 'answer')
      return send(await answerMentor(p.id, d.id, d.choice, d.elapsedMs, d.reveal));
    if (d.action === 'hint') return send(await hintMentor(p.id, d.id));
    return send(await finishMentor(p.id, d.id));
  } catch (e) {
    return send(
      { error: e instanceof ApiError ? e.message : 'تعذر تنفيذ الطلب. حاول مجددًا.' },
      e instanceof ApiError ? e.status : 400,
    );
  }
}
export { handle as GET, handle as POST };
