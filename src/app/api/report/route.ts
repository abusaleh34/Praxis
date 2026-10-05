import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, requireParticipant, sameOrigin, token, hash, limit } from '@/lib/auth';
import { reportFor } from '@/lib/report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const send = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(req: NextRequest) {
  try {
    const p = await requireParticipant();
    if (req.method === 'GET') {
      const [report, shares] = await Promise.all([
        reportFor(p.id),
        db()`SELECT token_hash AS id,created_at,expires_at FROM report_shares WHERE participant_id=${p.id} AND expires_at>now() ORDER BY created_at DESC`,
      ]);
      return send({ report, shares });
    }
    sameOrigin(req);
    const raw = await req.text();
    if (raw.length > 1000) throw new ApiError(413, 'الطلب كبير.');
    const data = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('share'), consent: z.literal(true) }),
        z.object({ action: z.literal('revoke'), id: z.string().regex(/^[a-f0-9]{64}$/) }),
      ])
      .parse(JSON.parse(raw));
    if (data.action === 'revoke') {
      await db()`DELETE FROM report_shares WHERE token_hash=${data.id} AND participant_id=${p.id}`;
      return send({ ok: true });
    }
    await limit('report-share:' + p.id, 10, 86400);
    const value = token(),
      snapshot = await reportFor(p.id);
    const [share] =
      await db()`INSERT INTO report_shares(token_hash,participant_id,snapshot) VALUES(${hash(value)},${p.id},${db().json(snapshot)}) RETURNING expires_at`;
    return send({ token: value, expiresAt: share.expires_at });
  } catch (e) {
    return send(
      { error: e instanceof ApiError ? e.message : 'تعذّر تجهيز التقرير.' },
      e instanceof ApiError ? e.status : 400,
    );
  }
}
export { handle as GET, handle as POST };
