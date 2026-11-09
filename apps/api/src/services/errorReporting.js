import * as Sentry from '@sentry/node';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-forwarded-for'];

/** Replaces the value of a `token` query parameter (email links) with [redacted], in URLs or bare query strings. */
export const redactTokens = (text) =>
  typeof text === 'string' ? text.replace(/(^|[?&\s])(token=)[^&#\s]+/gi, '$1$2[redacted]') : text;

/**
 * Strips personal data before an event leaves the server: request bodies (passwords, profile
 * data), cookies, auth headers, IP addresses, emails, link tokens. Only the rider's id stays.
 */
export function scrubEvent(event) {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete event.request.headers[name];
      }
    }
    event.request.url = redactTokens(event.request.url);
    event.request.query_string = redactTokens(event.request.query_string);
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.data?.url) crumb.data.url = redactTokens(crumb.data.url);
    crumb.message = redactTokens(crumb.message);
  }
  return event;
}

/**
 * Turns on Sentry when SENTRY_DSN is set. Returns a reporter for unexpected (500) errors, or null.
 */
export function initErrorReporting(config) {
  if (!config.sentryDsn) return null;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    release: process.env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only, no performance tracing
    beforeSend: scrubEvent,
    beforeBreadcrumb: (crumb) => {
      if (crumb.data?.url) crumb.data.url = redactTokens(crumb.data.url);
      return crumb;
    },
  });
  return (err, req) => {
    Sentry.withScope((scope) => {
      if (req?.user?.id) scope.setUser({ id: req.user.id });
      scope.setTag('route', `${req?.method} ${req?.baseUrl ?? ''}${req?.route?.path ?? ''}`);
      Sentry.captureException(err);
    });
  };
}
