/**
 * Fail fast on unsafe configuration. The compose file defaults are dev-only;
 * the stack is internet-facing, so a weak secret must never boot in production.
 */
export function validateEnv(env: Record<string, unknown>) {
  const isProd = env.NODE_ENV === 'production';
  const errors: string[] = [];

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = String(env[key] ?? '');
    if (v.length < 32) errors.push(`${key} must be at least 32 characters`);
    if (isProd && /dev-only|change-me|replace-me/i.test(v)) {
      errors.push(`${key} is a placeholder; set a real value in production`);
    }
  }
  if (isProd && !env.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS is required in production (the web origin)');
  }
  if (errors.length) {
    throw new Error(`Invalid environment:\n - ${errors.join('\n - ')}`);
  }
  return env;
}
