import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { apiRoutes } from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

/** Builds the Express app. Exported separately from server.js so tests can use it without listening on a port. */
export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // Defaults, plus what Google Identity Services needs (script, button iframe, styles)
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
          'frame-src': ["'self'", 'https://accounts.google.com/gsi/'],
          'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        },
      },
      // Google's sign-in popup must be able to talk back to this page
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      // Google checks the page's origin; "no-referrer" (helmet's default) breaks the button
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use('/api', cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiRoutes(config));
  app.use('/api', notFound);

  serveWebApp(app, config.webDistPath);

  app.use(notFound);
  app.use(errorHandler(config));
  return app;
}

// In production the built React app (apps/web/dist) is served from the same origin as the API.
function serveWebApp(app, distPath) {
  const indexHtml = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexHtml)) return;
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml); // client-side routing fallback
  });
}
