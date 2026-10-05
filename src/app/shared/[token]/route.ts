import { db } from '@/lib/db';
import { hash } from '@/lib/auth';
import type { ProgressReport } from '@/lib/report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const value = (await ctx.params).token;
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
  if (!/^[\w-]{43}$/.test(value)) return new Response('الرابط غير صالح.', { status: 404, headers });
  const [row] =
    await db()`SELECT snapshot,expires_at FROM report_shares WHERE token_hash=${hash(value)} AND expires_at>now()`;
  if (!row) return new Response('انتهت صلاحية التقرير أو أُلغي الرابط.', { status: 404, headers });
  const r = row.snapshot as ProgressReport;
  return new Response(
    `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Praxis — تقرير التقدّم</title><style>body{font:17px/1.9 Arial,sans-serif;background:#f5f8f6;color:#192d36;margin:0;padding:24px}main{max-width:760px;margin:24px auto;background:white;padding:30px;border-radius:20px}h1{color:#137c68}.stats{display:flex;gap:25px;flex-wrap:wrap}section{border-top:1px solid #ddd;padding:18px 0}small{color:#586b68}</style><main><small>PRAXIS · تقرير شاركه الطالب · للقراءة فقط</small><h1>خطوة أقرب إلى الفهم</h1><p>${esc(r.period)} حتى ${esc(new Date(r.generatedAt).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' }))}</p><div class="stats"><b>${r.attempts} محاولات</b><b>${r.accuracy === null ? '—' : r.accuracy + '%'} ${r.scoringNote ? 'إجابات صحيحة عند التقييم' : 'صحيح من أول محاولة'}</b><b>${r.minutes} دقيقة مسجلة</b></div><p>${esc(r.scoringNote ?? '')}</p><section><h2>نقاط القوة</h2><p>${esc(r.strong.join('، ') || 'نحتاج محاولات مستقلة أكثر قبل تحديد نقاط القوة.')}</p><h2>ما نراجعه الآن</h2><p>${esc(r.review.join('، ') || 'لم تظهر أدلة كافية لتحديد فجوات بعد.')}</p></section><section><h2>الخطوة التالية</h2><p>${esc(r.recommendation.reason)}</p><p>${esc(r.note)}</p></section><small>لقطة ثابتة من التقدم وقت المشاركة. الدقة والزمن من الاستخدام المسجل داخل التطبيق، وليسا درجة متوقعة لاختبار رسمي. ينتهي هذا الرابط ${esc(new Date(row.expires_at).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' }))}. لا يتيح الرابط الدخول إلى حساب الطالب.</small></main></html>`,
    { headers },
  );
}
