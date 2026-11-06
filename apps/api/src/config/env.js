import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads configuration from environment variables (see /.env.example).
 * Pass a plain object instead of process.env in tests.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  const required = (key) => {
    const value = env[key];
    if (!value) throw new Error(`Missing required environment variable ${key}. See .env.example.`);
    return value;
  };

  const jwtSecret = required('JWT_SECRET');
  const jwtRefreshSecret = required('JWT_REFRESH_SECRET');
  if (jwtSecret === jwtRefreshSecret) throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  if (isProd && (jwtSecret.length < 32 || jwtRefreshSecret.length < 32)) {
    throw new Error('JWT secrets must be at least 32 characters in production.');
  }

  return Object.freeze({
    nodeEnv,
    isProd,
    isTest: nodeEnv === 'test',
    port: Number(env.PORT ?? 4000),
    mongoUri: required('MONGODB_URI'),
    jwtSecret,
    jwtRefreshSecret,
    accessTokenTtlSec: 15 * 60,
    refreshTokenTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS ?? 7),
    bcryptCost: Number(env.BCRYPT_COST ?? 12),
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
    trustProxy: isProd, // Render sits behind a proxy: needed for real client IPs (rate limiting) and secure cookies
    rateLimitEnabled: nodeEnv !== 'test',
    webDistPath: env.WEB_DIST_PATH ?? path.resolve(here, '../../../web/dist'),
  });
}
