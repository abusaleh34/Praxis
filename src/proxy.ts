import { NextRequest, NextResponse } from 'next/server';
import { previewAccess } from './lib/preview-access';

export function proxy(req: NextRequest) {
  const required =
    process.env.PRAXIS_PREVIEW_REQUIRED === 'true' ||
    Boolean(
      process.env.RAILWAY_ENVIRONMENT_ID &&
        (!process.env.PRAXIS_MODE || process.env.PRAXIS_MODE === 'development'),
    );
  const access = previewAccess(
    req.headers.get('authorization'),
    process.env.PRAXIS_PREVIEW_PASSWORD,
    required,
  );
  if (access === 'unconfigured') {
    return new NextResponse('المعاينة غير جاهزة بعد.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // Railway probes database readiness without browser credentials.
  if (req.method === 'GET' && req.nextUrl.pathname === '/api/health') return NextResponse.next();
  if (access === 'unauthorized') {
    return new NextResponse('هذه معاينة خاصة. أدخل بيانات الدخول للمتابعة.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Praxis preview", charset="UTF-8"',
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  }
  const response = NextResponse.next();
  if (access !== 'open') {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}
