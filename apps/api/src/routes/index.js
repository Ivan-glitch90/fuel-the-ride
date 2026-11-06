import { Router } from 'express';
import { isDbConnected } from '../config/db.js';
import { authRoutes } from './auth.js';
import { usersRoutes } from './users.js';
import { foodsRoutes } from './foods.js';
import { ridesRoutes } from './rides.js';
import { checkInsRoutes } from './checkins.js';

export function apiRoutes(config) {
  const router = Router();

  // Liveness check for Docker, Render and CI
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', db: isDbConnected() ? 'up' : 'down', uptimeSec: Math.round(process.uptime()) });
  });

  router.use('/auth', authRoutes(config));
  router.use('/users', usersRoutes(config));
  router.use('/foods', foodsRoutes(config));
  router.use('/rides', ridesRoutes(config));
  router.use('/checkins', checkInsRoutes(config));
  // Next: /progress

  return router;
}
