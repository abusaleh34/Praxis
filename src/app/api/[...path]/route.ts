import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  participant,
  requireParticipant,
  requireAdmin,
  isAdmin,
  sameOrigin,
  limit,
  hash,
  token,
  equals,
  cookieOptions,
} from '@/lib/auth';
import { questions, questionMap, contentHash } from '@/lib/content';
import { CONSENT_VERSION, toCsv } from '@/lib/rules';
import { readiness } from '@/lib/readiness';
import { sessionState, startSession, answerQuestion, overview } from '@/lib/study';
import { requestHint } from '@/lib/hints';
import { adminOverview } from '@/lib/admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function body(req: Request) {
  const text = await req.text();
  if (text.length > 10000) throw new ApiError(413, 'الطلب أكبر من المسموح.');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'بيانات غير صالحة.');
  }
}
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path;
    const route = path.join('/');
    const method = req.method;
    if (method !== 'GET') sameOrigin(req);
    if (method === 'GET' && route === 'health') {
      await db()`SELECT 1`;
      return json({ ok: true, app: 'Praxis' });
    }
    if (method === 'GET' && route === 'config') {
      const r = await readiness();
      return json({
        mode: r.mode,
        open:
          r.mode === 'development' ||
          (r.mode === 'pilot' && r.ready) ||
          (r.mode === 'waitlist' && r.flags.privacy),
        authenticated: Boolean(await participant()),
        channelUrl: /^https:\/\/t\.me\//.test(process.env.PRAXIS_TELEGRAM_CHANNEL_URL ?? '')
          ? process.env.PRAXIS_TELEGRAM_CHANNEL_URL
          : null,
      });
    }
    if (method === 'POST' && route === 'enroll') {
      const data = z
        .object({
          consent: z.literal(true),
          source: z
            .string()
            .max(50)
            .regex(/^[a-zA-Z0-9_-]+$/)
            .default('direct'),
          code: z.string().max(150).optional(),
        })
        .parse(await body(req));
      const r = await readiness();
      if ((r.mode === 'pilot' && !r.ready) || (r.mode === 'waitlist' && !r.flags.privacy))
        throw new ApiError(403, 'التجربة ليست مفتوحة بعد.');
      if (r.mode === 'pilot' && !equals(data.code ?? '', process.env.PRAXIS_PILOT_CODE ?? ''))
        throw new ApiError(403, 'رمز الدعوة غير صحيح.');
      const existing = await participant();
      if (existing) return json({ id: existing.id, existing: true });
      await limit(
        'enroll:' + hash(req.headers.get('x-real-ip') ?? 'local'),
        r.mode === 'development' ? 1000 : 30,
      );
      const t = token();
      const [p] =
        await db()`INSERT INTO participants(session_hash,consent_version,source,mode) VALUES(${hash(t)},${CONSENT_VERSION},${data.source},${r.mode}) RETURNING id`;
      (await cookies()).set('praxis_session', t, cookieOptions(req));
      await db()`INSERT INTO events(participant_id,name) VALUES(${p.id},'registered')`;
      return json({ id: p.id }, 201);
    }
    if (method === 'POST' && route === 'admin/login') {
      await limit('admin-login:' + hash(req.headers.get('x-real-ip') ?? 'local'), 15, 900);
      const { secret } = z.object({ secret: z.string().min(1).max(200) }).parse(await body(req));
      if (!process.env.PRAXIS_ADMIN_TOKEN || !equals(secret, process.env.PRAXIS_ADMIN_TOKEN))
        throw new ApiError(401, 'رمز المشرف غير صحيح.');
      (await cookies()).set('praxis_admin', hash(secret), cookieOptions(req, 60 * 60 * 8));
      return json({ ok: true });
    }
    if (method === 'POST' && route === 'admin/logout') {
      (await cookies()).delete('praxis_admin');
      return json({ ok: true });
    }
    if (path[0] === 'admin') {
      await requireAdmin();
      if (method === 'GET' && route === 'admin/overview') return json(await adminOverview());
      if (method === 'GET' && route === 'admin/content') {
        const reviews = await db()`SELECT * FROM content_reviews`;
        return json(
          questions.map((q) => ({
            ...q,
            hash: contentHash(q),
            review:
              reviews.find((r) => r.question_id === q.id && r.content_hash === contentHash(q)) ??
              null,
          })),
        );
      }
      if (method === 'POST' && route === 'admin/review') {
        const data = z
          .object({
            questionId: z.string(),
            hash: z.string(),
            reviewer: z.string().trim().min(2).max(80),
            notes: z.string().max(1000).default(''),
            verified: z.literal(true),
          })
          .parse(await body(req));
        const q = questionMap.get(data.questionId);
        if (!q || contentHash(q) !== data.hash)
          throw new ApiError(409, 'تغيّر المحتوى. حدّث السؤال قبل اعتماده.');
        await db()`INSERT INTO content_reviews(question_id,content_hash,reviewer,notes) VALUES(${q.id},${data.hash},${data.reviewer},${data.notes}) ON CONFLICT(question_id) DO UPDATE SET content_hash=excluded.content_hash,reviewer=excluded.reviewer,notes=excluded.notes,approved_at=now()`;
        return json({ ok: true });
      }
      if (method === 'DELETE' && route === 'admin/review') {
        const { questionId } = z.object({ questionId: z.string() }).parse(await body(req));
        await db()`DELETE FROM content_reviews WHERE question_id=${questionId}`;
        return json({ ok: true });
      }
      if (method === 'GET' && route === 'admin/export') {
        const data = await adminOverview();
        return new NextResponse(toCsv(data.participants), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="praxis-participants.csv"',
            'Cache-Control': 'no-store',
          },
        });
      }
      if (method === 'POST' && route === 'admin/payment') {
        const data = z
          .object({
            participantId: uuid,
            reference: z.string().trim().min(3).max(100),
            status: z.enum(['paid', 'refunded']),
            verified: z.literal(true),
          })
          .parse(await body(req));
        const p = await db()`SELECT id FROM participants WHERE id=${data.participantId}`;
        if (!p.length) throw new ApiError(404, 'المشارك غير موجود.');
        const saved =
          await db()`INSERT INTO payments(participant_id,reference,amount,status) VALUES(${data.participantId},${data.reference},14900,${data.status}) ON CONFLICT(reference) DO UPDATE SET status=excluded.status WHERE payments.participant_id=excluded.participant_id RETURNING id`;
        if (!saved.length) throw new ApiError(409, 'مرجع الدفع مرتبط بمشارك آخر.');
        return json({ ok: true });
      }
      throw new ApiError(404, 'المسار غير موجود.');
    }
    const p = await requireParticipant();
    if (method === 'POST' && route === 'logout') {
      (await cookies()).delete('praxis_session');
      return json({ ok: true });
    }
    if (method === 'DELETE' && route === 'account') {
      await db()`DELETE FROM participants WHERE id=${p.id}`;
      (await cookies()).delete('praxis_session');
      return json({ ok: true });
    }
    if (process.env.PRAXIS_MODE === 'pilot' && !(await readiness()).ready)
      throw new ApiError(503, 'التجربة متوقفة مؤقتًا للمراجعة.');
    if (method === 'GET' && route === 'overview') return json(await overview(p.id));
    if (method === 'POST' && route === 'sessions') {
      if (process.env.PRAXIS_MODE === 'waitlist')
        throw new ApiError(403, 'سُجّل اهتمامك. التدريب لم يفتح بعد.');
      const data = z
        .object({ kind: z.enum(['pre', 'practice', 'post']), skill: z.string().max(30).optional() })
        .parse(await body(req));
      const id = await startSession(p.id, data.kind, data.skill);
      return json({ id }, 201);
    }
    if (path[0] === 'sessions' && path[1]) {
      const id = uuid.parse(path[1]);
      if (method === 'GET' && path.length === 2) return json(await sessionState(id, p.id));
      if (method === 'POST' && path[2] === 'answer') {
        const data = z
          .object({
            questionId: z.string().max(30),
            choice: z.number().int().min(0).max(3).nullable(),
            elapsedMs: z.number().int().min(0).max(3600000),
            reveal: z.boolean().default(false),
          })
          .parse(await body(req));
        return json(
          await answerQuestion(p.id, id, data.questionId, data.choice, data.elapsedMs, data.reveal),
        );
      }
      if (method === 'POST' && path[2] === 'hint') {
        await limit('hints:' + p.id, 100, 3600);
        const data = z
          .object({
            questionId: z.string().max(30),
            stage: z.number().int().min(1).max(3),
            choice: z.number().int().min(0).max(3).nullable().default(null),
          })
          .parse(await body(req));
        return json(await requestHint(p.id, id, data.questionId, data.stage, data.choice));
      }
    }
    if (method === 'POST' && route === 'offer') {
      const state = await overview(p.id);
      if (!state.offer.enabled || !state.offer.eligible)
        throw new ApiError(403, 'العرض غير متاح حاليًا.');
      const target = process.env.PRAXIS_CHECKOUT_URL!;
      if (new URL(target).protocol !== 'https:')
        throw new ApiError(503, 'رابط الدفع لم يُجهّز بعد.');
      await db()`INSERT INTO events(participant_id,name) SELECT ${p.id},'offer_viewed' WHERE NOT EXISTS(SELECT 1 FROM events WHERE participant_id=${p.id} AND name='offer_viewed')`;
      return json({ url: target });
    }
    if (method === 'POST' && route === 'decline') {
      const { reason } = z
        .object({ reason: z.enum(['price', 'geometry_only', 'not_needed', 'other']) })
        .parse(await body(req));
      const offered =
        await db()`SELECT id FROM events WHERE participant_id=${p.id} AND name='offer_viewed' LIMIT 1`;
      if (!offered.length) throw new ApiError(409, 'لم يُعرض الاشتراك بعد.');
      await db()`INSERT INTO events(participant_id,name,value) SELECT ${p.id},'decline_reason',${reason} WHERE NOT EXISTS(SELECT 1 FROM events WHERE participant_id=${p.id} AND name='decline_reason')`;
      return json({ ok: true });
    }
    throw new ApiError(404, 'المسار غير موجود.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json({ error: 'راجع البيانات المدخلة وحاول مجددًا.' }, 400);
    // Never return database connection details, model payloads, or credentials.
    console.error('Praxis request failed:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'تعذّر إكمال الطلب. حاول مرة أخرى.' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
