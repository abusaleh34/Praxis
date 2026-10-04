import { createHash, timingSafeEqual } from 'node:crypto';

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
