// Thin fetch wrapper for the Fuel the Ride API.
// - Sends cookies (the session lives in httpOnly cookies)
// - On a 401, refreshes the session once and retries the request
// - Turns error responses into ApiError { status, code, message, details }

const NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code ?? 'UNKNOWN';
    this.details = error.details ?? [];
  }
}

// Several requests can hit a 401 at once; they all wait for a single refresh.
let refreshPromise = null;
function refreshSession() {
  refreshPromise ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

/**
 * @param {string} path  API path without the /api prefix, e.g. '/foods'
 * @param {{ method?: string, body?: unknown, query?: Record<string, unknown> }} [options]
 * @returns {Promise<any>} parsed JSON, or null for 204
 */
export async function api(path, { method = 'GET', body, query } = {}, { retried = false } = {}) {
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: "Can't reach the server. Check your connection." });
  }

  if (res.status === 401 && !retried && !NO_REFRESH.has(path) && (await refreshSession())) {
    return api(path, { method, body, query }, { retried: true });
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data;
}

/** Maps an ApiError's details to { field: message } for forms. `profile.weightKg` → `weightKg`. */
export function fieldErrors(error) {
  const out = {};
  for (const detail of error?.details ?? []) {
    const key = detail.path.replace(/^profile\./, '');
    out[key] ??= detail.message;
  }
  return out;
}
