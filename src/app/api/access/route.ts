import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import {
  ApiError,
  cookieOptions,
  hash,
  limit,
  requireParticipant,
  sameOrigin,
  token,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  try {
    const p = await requireParticipant();
    const [row] =
      await db()`SELECT recovery_hash IS NOT NULL AS enabled FROM participants WHERE id=${p.id}`;
    return json(row);
  } catch (e) {
    return json(
      { error: e instanceof ApiError ? e.message : 'تعذّر تحميل إعدادات الحساب.' },
      e instanceof ApiError ? e.status : 500,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const raw = await req.text();
    if (raw.length > 2048) throw new ApiError(413, 'الطلب أكبر من المسموح.');
    const data = z
      .object({ action: z.enum(['create', 'restore']), code: z.string().max(100).optional() })
      .parse(JSON.parse(raw));
    if (data.action === 'create') {
      const p = await requireParticipant();
      const code = 'PX-' + randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
      await db()`UPDATE participants SET recovery_hash=${hash(code.replace(/[^A-Z0-9]/g, ''))} WHERE id=${p.id}`;
      return json({ code });
    }
    await limit('restore:' + hash(req.headers.get('x-real-ip') ?? 'local'), 15, 900);
    const code = (data.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^PX[A-F0-9]{32}$/.test(code)) throw new ApiError(400, 'تحقق من رمز الدخول كاملًا.');
    const mode = ['pilot', 'waitlist'].includes(process.env.PRAXIS_MODE ?? '')
      ? process.env.PRAXIS_MODE!
      : 'development';
    const t = token();
    const rows =
      await db()`UPDATE participants SET session_hash=${hash(t)} WHERE recovery_hash=${hash(code)} AND mode=${mode} RETURNING id`;
    if (!rows.length) throw new ApiError(401, 'رمز الدخول غير صحيح أو لم يعد متاحًا.');
    (await cookies()).set('praxis_session', t, cookieOptions(req));
    return json({ ok: true });
  } catch (e) {
    return json(
      { error: e instanceof ApiError ? e.message : 'تعذّر تنفيذ الطلب. تحقق من البيانات.' },
      e instanceof ApiError ? e.status : 400,
    );
  }
}
