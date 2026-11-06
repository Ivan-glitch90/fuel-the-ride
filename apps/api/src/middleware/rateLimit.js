import rateLimit from 'express-rate-limit';

/** Limits brute-force attempts on login/register: 20 requests per 15 min per IP. */
export function authRateLimiter(config) {
  if (!config.rateLimitEnabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } }),
  });
}
