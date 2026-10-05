import { NextRequest, NextResponse } from 'next/server';
import {
  PREVIEW_COOKIE,
  previewAccess,
  previewRequired,
  validPreviewSession,
} from './lib/preview-access';

export function proxy(req: NextRequest) {
  const access = previewAccess(
    req.headers.get('authorization'),
    process.env.PRAXIS_PREVIEW_PASSWORD,
    previewRequired(),
  );
  if (access === 'unconfigured') {
    return new NextResponse('المعاينة غير جاهزة بعد.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // Only an expiring, unguessable report token grants access to this read-only snapshot.
  if (req.method === 'GET' && /^\/shared\/[\w-]{43}$/.test(req.nextUrl.pathname))
    return NextResponse.next();
  // Railway probes database readiness without browser credentials.
  if (req.method === 'GET' && req.nextUrl.pathname === '/api/health') return NextResponse.next();
  if (
    access === 'unauthorized' &&
    req.nextUrl.pathname !== '/preview' &&
    !validPreviewSession(
      req.cookies.get(PREVIEW_COOKIE)?.value,
      process.env.PRAXIS_PREVIEW_PASSWORD,
    )
  ) {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    };
    if (
      ['GET', 'HEAD'].includes(req.method) &&
      !/^\/(?:api|_next)(?:\/|$)/.test(req.nextUrl.pathname) &&
      !req.nextUrl.pathname.includes('.')
    ) {
      // Next's proxy requires an absolute Location. Preserve the public host
      // and HTTPS scheme when Railway forwards to the internal HTTP server.
      const protocol =
        req.headers.get('x-forwarded-proto') === 'https' ? 'https:' : req.nextUrl.protocol;
      const login = new URL(
        '/preview',
        `${protocol}//${req.headers.get('host') ?? req.nextUrl.host}`,
      );
      login.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(login, { status: 307, headers });
    }
    return NextResponse.json({ error: 'يلزم دخول المعاينة.' }, { status: 401, headers });
  }
  const response = NextResponse.next();
  if (access !== 'open') {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}
