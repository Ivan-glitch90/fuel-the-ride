import { api } from '../api/client.js';

// Browser error reporting. Sentry's code is only downloaded when the API says it's configured
// (GET /api/client-config), so riders don't pay for it otherwise.

let sentry = null;

/** Replaces the value of a `token` query parameter (email links) with [redacted]. */
export const redactTokens = (text) =>
  typeof text === 'string' ? text.replace(/(^|[?&\s])(token=)[^&#\s]+/gi, '$1$2[redacted]') : text;

/**
 * No personal data leaves the browser: no request bodies, cookies or headers, no email; the
 * confirm/reset pages carry a one-time token in their URL, so URLs are redacted everywhere.
 */
export function scrubBrowserEvent(event) {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    event.request.url = redactTokens(event.request.url);
    event.request.query_string = redactTokens(event.request.query_string);
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  event.transaction = redactTokens(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) {
    crumb.message = redactTokens(crumb.message);
    for (const key of ['url', 'from', 'to']) if (crumb.data?.[key]) crumb.data[key] = redactTokens(crumb.data[key]);
  }
  return event;
}

export async function startErrorReporting() {
  try {
    const { sentryDsn, environment, release } = await api('/client-config');
    if (!sentryDsn) return;
    sentry = await import('@sentry/browser');
    sentry.init({
      dsn: sentryDsn,
      environment,
      release,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: scrubBrowserEvent,
      beforeBreadcrumb: (crumb) => {
        for (const key of ['url', 'from', 'to']) if (crumb.data?.[key]) crumb.data[key] = redactTokens(crumb.data[key]);
        return crumb;
      },
    });
  } catch {
    // Reporting is optional: never break the app over it
  }
}

/** Tags reports with the logged-in rider's id (never their email). */
export function setReportingUser(id) {
  sentry?.setUser(id ? { id } : null);
}

export function reportError(error, extra) {
  sentry?.captureException(error, extra ? { extra } : undefined);
}
