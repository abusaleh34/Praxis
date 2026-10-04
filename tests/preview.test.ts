import { describe, it, expect } from 'vitest';
import { previewAccess } from '../src/lib/preview-access';
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
