import { Router } from 'express';
import { isDbConnected } from '../config/db.js';
import { createAuthController } from '../controllers/authController.js';
import { POLICY_VERSION } from '../policy.js';
import { authRoutes } from './auth.js';
import { usersRoutes } from './users.js';
import { foodsRoutes } from './foods.js';
import { ridesRoutes } from './rides.js';
import { checkInsRoutes } from './checkins.js';
import { progressRoutes } from './progress.js';
import { eventsRoutes } from './events.js';

export function apiRoutes(config) {
  const router = Router();

  // Liveness check for Docker, Render and CI. `version` is the deployed commit (Render sets
  // RENDER_GIT_COMMIT), so CI can tell when the new version is actually live.
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      db: isDbConnected() ? 'up' : 'down',
      uptimeSec: Math.round(process.uptime()),
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
    });
  });

  // Public settings the web app needs at runtime (one Docker image for every environment).
  // A Sentry DSN is designed to be public: it only allows sending events, not reading them.
  router.get('/client-config', (_req, res) => {
    res.json({
      sentryDsn: config.sentryDsnWeb ?? null,
      policyVersion: POLICY_VERSION,
      environment: config.nodeEnv,
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
    });
  });

  const auth = createAuthController(config); // one instance: shared by /auth and DELETE /users/me
  router.use('/auth', authRoutes(config, auth));
  router.use('/users', usersRoutes(config, auth));
  router.use('/foods', foodsRoutes(config));
  router.use('/rides', ridesRoutes(config));
  router.use('/checkins', checkInsRoutes(config));
  router.use('/progress', progressRoutes(config));
  router.use('/events', eventsRoutes(config));

  return router;
}
