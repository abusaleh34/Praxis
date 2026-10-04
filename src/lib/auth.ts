import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function equals(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
export async function participant() {
  const t = (await cookies()).get('praxis_session')?.value;
  if (!t) return null;
  const mode = ['pilot', 'waitlist'].includes(process.env.PRAXIS_MODE ?? '')
    ? process.env.PRAXIS_MODE!
    : 'development';
  const rows =
    await db()`SELECT id,created_at,source FROM participants WHERE session_hash=${hash(t)} AND mode=${mode}`;
  return rows[0] ?? null;
}
export async function requireParticipant() {
  const p = await participant();
  if (!p) throw new ApiError(401, 'انتهت الجلسة. ابدأ الدخول مجددًا.');
  return p;
}
export async function isAdmin() {
  const t = (await cookies()).get('praxis_admin')?.value;
  return Boolean(
    t && process.env.PRAXIS_ADMIN_TOKEN && equals(t, hash(process.env.PRAXIS_ADMIN_TOKEN)),
  );
}
export async function requireAdmin() {
  if (!(await isAdmin())) throw new ApiError(401, 'يلزم دخول المشرف.');
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) throw new ApiError(403, 'مصدر الطلب غير صالح.');
  try {
    if (new URL(origin).host !== req.headers.get('host')) throw new Error();
  } catch {
    throw new ApiError(403, 'مصدر الطلب غير صالح.');
  }
}
export function cookieOptions(req: Request, maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.PRAXIS_SECURE_COOKIES === 'true' || new URL(req.url).protocol === 'https:',
    path: '/',
    maxAge,
  };
}
export async function limit(bucket: string, max: number, seconds = 3600) {
  const rows =
    await db()`INSERT INTO rate_limits(bucket,count,expires_at) VALUES(${bucket},1,now()+${seconds}*interval '1 second')
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,
 expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+${seconds}*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`;
  if (rows[0].count > max) throw new ApiError(429, 'طلبات كثيرة خلال وقت قصير. حاول لاحقًا.');
}
