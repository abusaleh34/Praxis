import { describe, it, expect } from 'vitest';
import {
  PREVIEW_MAX_AGE,
  issuePreviewSession,
  previewAccess,
  previewReturnPath,
  validPreviewSession,
} from '../src/lib/preview-access';
import { validatePreviewConfig } from '../scripts/preview-config.mjs';

const password = 'preview-test-password-long-enough';
const basic = (value: string) => 'Basic ' + Buffer.from(value).toString('base64');
describe('private hosted preview', () => {
  it('keeps ordinary local development available', () => {
    expect(previewAccess(null, undefined, false)).toBe('open');
  });
  it('fails closed when a required preview password is missing or weak', () => {
    expect(previewAccess(null, undefined, true)).toBe('unconfigured');
    expect(previewAccess(null, 'short', false)).toBe('unconfigured');
  });
  it('requires the preview identity and correct password', () => {
    for (const header of [
      null,
      'Bearer example',
      'Basic !!!',
      basic('praxis:wrong'),
      basic(`other:${password}`),
    ])
      expect(previewAccess(header, password, true)).toBe('unauthorized');
    expect(previewAccess(basic(`praxis:${password}`), password, true)).toBe('authorized');
  });
  it('accepts signed sessions, but rejects tampering, expiry, and a changed password', () => {
    const now = 1_790_000_000_000;
    const session = issuePreviewSession(password, now);
    expect(validPreviewSession(session, password, now)).toBe(true);
    expect(validPreviewSession(session, password, now + 60_000)).toBe(true);
    expect(validPreviewSession(session, password, now + PREVIEW_MAX_AGE * 1000)).toBe(false);
    expect(validPreviewSession(session, password + 'rotated', now)).toBe(false);
    expect(validPreviewSession(session.replace(/^./, '2'), password, now)).toBe(false);
    const parts = session.split('.');
    parts[1] = '0'.repeat(32);
    expect(validPreviewSession(parts.join('.'), password, now)).toBe(false);
    expect(validPreviewSession(session, undefined, now)).toBe(false);
    expect(validPreviewSession('invalid', password, now)).toBe(false);
    expect(validPreviewSession(undefined, password, now)).toBe(false);
  });
  it('returns only safe local paths and prevents login loops', () => {
    expect(previewReturnPath('/start?source=preview')).toBe('/start?source=preview');
    expect(previewReturnPath('/session/example')).toBe('/session/example');
    for (const path of [
      null,
      '//example.com',
      'https://example.com',
      '/\\example.com',
      '/%2fexample.com',
      '/%5cexample.com',
      '/a/..//example.com',
      '/a/%2e%2e//example.com',
      '/preview',
      '/preview?next=/start',
      '/\n/example.com',
    ]) {
      expect(previewReturnPath(path)).toBe('/');
    }
  });
  it('validates the hosted runtime and never prints input secrets in failures', () => {
    const env = {
      DATABASE_URL: 'postgres://test:test@db:5432/praxis',
      PRAXIS_ADMIN_TOKEN: 'a'.repeat(32),
      PRAXIS_PREVIEW_PASSWORD: password,
      PRAXIS_PREVIEW_REQUIRED: 'true',
      PRAXIS_SECURE_COOKIES: 'true',
      PRAXIS_MODE: 'development',
      PORT: '8080',
    };
    expect(validatePreviewConfig(env)).toEqual([]);
    const failures = validatePreviewConfig({
      ...env,
      DATABASE_URL: 'private-invalid-url',
      PORT: '0',
      PRAXIS_SECURE_COOKIES: 'false',
      PRAXIS_CHECKOUT_URL: 'https://payment.example',
    });
    expect(failures).toHaveLength(4);
    expect(failures.join(' ')).not.toContain('private-invalid-url');
    expect(validatePreviewConfig({})).toHaveLength(6);
  });
});
