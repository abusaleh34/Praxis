import { NextRequest, NextResponse } from 'next/server';
import { ApiError, cookieOptions, equals, hash, limit, sameOrigin } from '../../lib/auth';
import {
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE,
  issuePreviewSession,
  previewAccess,
  previewRequired,
  previewReturnPath,
  validPreviewSession,
} from '../../lib/preview-access';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

function form(next: string, message = '', status = 200) {
  return new NextResponse(
    `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>دخول المعاينة | Praxis</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#f2f6f4;color:#203e40;font:17px/1.8 system-ui,sans-serif}
main{width:100%;max-width:440px;padding:36px;background:white;border:1px solid #dce6df;border-radius:24px;box-shadow:0 16px 60px #203e4009}
.brand{color:#217d6d;font-weight:750;letter-spacing:3px;font-size:21px}.badge{display:inline-block;margin-top:24px;padding:3px 12px;border-radius:20px;background:#edf5f0;color:#386b5b;font-size:13px}
h1{font-size:27px;line-height:1.5;margin:14px 0 8px}p{margin:0 0 24px;color:#5a6e6c}label{display:block;font-size:15px;font-weight:600;margin-bottom:8px}
input,button{width:100%;font:inherit;border-radius:12px;min-height:50px}input{padding:10px 14px;border:1px solid #a7bdb3;background:#fbfdfb}input:focus-visible,button:focus-visible{outline:3px solid #81c7b2;outline-offset:3px}
button{margin-top:18px;border:0;background:#216b5c;color:#fff;cursor:pointer;font-weight:650}button:hover{background:#195747}.error{margin:12px 0 0;color:#a52d31;font-size:14px}
small{display:block;margin-top:24px;color:#687b75;font-size:12px}
</style></head><body><main>
<div class="brand" dir="ltr">△ PRAXIS</div><span class="badge">معاينة خاصة</span>
<h1>أهلًا بك في Praxis</h1><p>أدخل كلمة مرور المعاينة لتبدأ رحلتك.</p>
<form method="post" action="/preview">
<input type="hidden" name="next" value="${escape(next)}">
<label for="password">كلمة مرور المعاينة</label>
<input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" dir="ltr" ${message ? 'aria-describedby="error"' : ''}>
${message ? `<p class="error" id="error" role="alert">${escape(message)}</p>` : ''}
<button type="submit">دخول المعاينة</button></form>
<small>نسخة تجريبية للمراجعة قبل الإطلاق.</small>
</main></body></html>`,
    {
      status,
      headers: {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}

export function GET(req: NextRequest) {
  const next = previewReturnPath(req.nextUrl.searchParams.get('next'));
  if (
    previewAccess(null, process.env.PRAXIS_PREVIEW_PASSWORD, previewRequired()) === 'open' ||
    validPreviewSession(req.cookies.get(PREVIEW_COOKIE)?.value, process.env.PRAXIS_PREVIEW_PASSWORD)
  )
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: next } });
  return form(next);
}

export async function POST(req: NextRequest) {
  let next = '/';
  try {
    sameOrigin(req);
    if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      throw new ApiError(415, 'صيغة الطلب غير صالحة. أعد المحاولة من صفحة الدخول.');
    }
    // Bound streamed bodies as well as ordinary browser form submissions.
    const reader = req.body?.getReader();
    if (!reader) throw new ApiError(400, 'أدخل كلمة مرور المعاينة.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError(413, 'الطلب طويل جدًا. أعد المحاولة.');
      }
      chunks.push(value);
    }
    const data = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    next = previewReturnPath(data.get('next'));
    await limit(`preview-login:${hash(req.headers.get('x-real-ip') ?? 'unknown')}`, 20, 900);
    const password = process.env.PRAXIS_PREVIEW_PASSWORD;
    if (!password || password.length < 24) throw new ApiError(503, 'المعاينة غير جاهزة بعد.');
    const supplied = data.get('password') ?? '';
    if (supplied.length > 256 || !equals(supplied, password)) {
      throw new ApiError(401, 'كلمة المرور غير صحيحة. حاول مرة أخرى.');
    }
    const response = new NextResponse(null, {
      status: 303,
      headers: { ...headers, Location: next },
    });
    response.cookies.set(
      PREVIEW_COOKIE,
      issuePreviewSession(password),
      cookieOptions(req, PREVIEW_MAX_AGE),
    );
    return response;
  } catch (error) {
    return form(
      next,
      error instanceof ApiError ? error.message : 'تعذّر الدخول الآن. حاول بعد قليل.',
      error instanceof ApiError ? error.status : 503,
    );
  }
}
