import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PREVIEW_COOKIE = 'praxis_preview';
export const PREVIEW_MAX_AGE = 60 * 60 * 24 * 7;

export function previewRequired() {
  return (
    process.env.PRAXIS_PREVIEW_REQUIRED === 'true' ||
    Boolean(
      process.env.RAILWAY_ENVIRONMENT_ID &&
        (!process.env.PRAXIS_MODE || process.env.PRAXIS_MODE === 'development'),
    )
  );
}

function signature(payload: string, password: string) {
  return createHmac('sha256', password).update(`praxis-preview:v1:${payload}`).digest('hex');
}

export function issuePreviewSession(password: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + PREVIEW_MAX_AGE}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${signature(payload, password)}`;
}

export function validPreviewSession(
  session: string | undefined,
  password: string | undefined,
  now = Date.now(),
) {
  if (!password || password.length < 24 || !session || session.length > 128) return false;
  const match = /^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(session);
  if (!match) return false;
  const expiry = Number(match[1]);
  const seconds = Math.floor(now / 1000);
  if (expiry <= seconds || expiry > seconds + PREVIEW_MAX_AGE) return false;
  return timingSafeEqual(
    Buffer.from(match[3], 'hex'),
    Buffer.from(signature(`${match[1]}.${match[2]}`, password), 'hex'),
  );
}

export function previewReturnPath(value: string | null) {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return '/';
  // Reject encoded separators too, keeping redirects on this site's page routes.
  if (/[\\\u0000-\u0020\u007f]|%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return '/';
  const url = new URL(value, 'https://preview.invalid');
  if (
    url.origin !== 'https://preview.invalid' ||
    url.pathname.startsWith('//') ||
    /^\/preview(?:\/|$)/.test(url.pathname)
  )
    return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function previewAccess(
  authorization: string | null,
  password: string | undefined,
  required: boolean,
): 'open' | 'authorized' | 'unauthorized' | 'unconfigured' {
  if (!password && !required) return 'open';
  if (!password || password.length < 24) return 'unconfigured';
  if (!authorization || authorization.length > 2048) return 'unauthorized';
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!match) return 'unauthorized';
  const supplied = Buffer.from(match[1], 'base64').toString('utf8');
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`praxis:${password}`))
    ? 'authorized'
    : 'unauthorized';
}
