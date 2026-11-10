import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ridesController as rides, screenshotController } from '../controllers/ridesController.js';
import { requestLanguage, translateMessage } from '../i18n.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePremium } from '../middleware/requirePremium.js';
import { validate } from '../middleware/validate.js';
import { createScreenshotReader } from '../services/screenshotService.js';
import { idParams } from '../validators/foods.js';
import {
  createRideBody,
  listRidesQuery,
  readScreenshotBody,
  similarRidesQuery,
  updateRideBody,
} from '../validators/rides.js';

/** Each screenshot costs an Anthropic API call: at most 30 per rider per day. */
function screenshotLimiter(config) {
  if (!config.rateLimitEnabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: translateMessage("You've read a lot of screenshots today. Try again tomorrow.", requestLanguage(req)),
        },
      }),
  });
}

export function ridesRoutes(config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/', validate({ query: listRidesQuery }), rides.list);
  router.post('/', validate({ body: createRideBody }), rides.create);
  router.get('/similar', validate({ query: similarRidesQuery }), rides.similar); // before /:id
  router.post(
    '/read-screenshot',
    requirePremium,
    screenshotLimiter(config),
    validate({ body: readScreenshotBody }),
    screenshotController(createScreenshotReader(config)),
  );

  router.get('/:id', validate({ params: idParams }), rides.get);
  router.patch('/:id', validate({ params: idParams, body: updateRideBody }), rides.update);
  router.delete('/:id', validate({ params: idParams }), rides.remove);

  return router;
}
