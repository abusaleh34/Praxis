export function validatePreviewConfig(env) {
  const errors = [];
  try {
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    errors.push('DATABASE_URL must be a PostgreSQL connection URL');
  }
  if ((env.PRAXIS_ADMIN_TOKEN?.length ?? 0) < 32)
    errors.push('PRAXIS_ADMIN_TOKEN must contain at least 32 characters');
  if ((env.PRAXIS_PREVIEW_PASSWORD?.length ?? 0) < 24)
    errors.push('PRAXIS_PREVIEW_PASSWORD must contain at least 24 characters');
  if (env.PRAXIS_MODE !== 'development')
    errors.push('PRAXIS_MODE must be development for this preview');
  if (env.PRAXIS_PREVIEW_REQUIRED !== 'true') errors.push('PRAXIS_PREVIEW_REQUIRED must be true');
  if (env.PRAXIS_SECURE_COOKIES !== 'true') errors.push('PRAXIS_SECURE_COOKIES must be true');
  if (env.PRAXIS_CHECKOUT_URL) errors.push('PRAXIS_CHECKOUT_URL must be empty for this preview');
  const port = env.PORT ?? '3000';
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535)
    errors.push('PORT must be a valid TCP port');
  return errors;
}
