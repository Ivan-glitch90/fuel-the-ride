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
    // Google sign-in is on when at least one OAuth client ID is set. The first is the web client;
    // more (comma-separated) can be added later for the iOS/Android apps.
    // Error tracking: Sentry is on only when a DSN is set. SENTRY_DSN_WEB (optional) for the browser app.
    sentryDsn: env.SENTRY_DSN,
    sentryDsnWeb: env.SENTRY_DSN_WEB ?? env.SENTRY_DSN,
    // Email (account confirmation, password reset). "log" prints emails to the server log;
    // "resend" sends them for real (needs RESEND_API_KEY and a verified sender domain).
    emailProvider: env.EMAIL_PROVIDER ?? 'log',
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM ?? 'Fuel the Ride <no-reply@fueltheride.app>',
    // Base address for links in emails. Required in production: links must never be built from the
    // request's Host header (an attacker could point reset links at their own site).
    publicAppUrl: env.PUBLIC_APP_URL?.replace(/\/$/, ''),
    googleClientIds: (env.GOOGLE_CLIENT_ID ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
    trustProxy: isProd, // Render sits behind a proxy: needed for real client IPs (rate limiting) and secure cookies
    rateLimitEnabled: nodeEnv !== 'test',
    webDistPath: env.WEB_DIST_PATH ?? path.resolve(here, '../../../web/dist'),
  });
}
