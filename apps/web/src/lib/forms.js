// Helpers for forms that keep inputs as strings and convert on submit.

/** '' → undefined, otherwise a number (accepts a comma as decimal separator). NaN if not a number. */
export function parseNumber(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return undefined;
  return Number(trimmed.replace(',', '.'));
}

export const isInvalidNumber = (value) => value !== undefined && !Number.isFinite(value);

export const roundTo = (value, decimals = 1) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** A number for an input's value: '' for null/undefined. */
export const toInput = (value, decimals) =>
  value === null || value === undefined ? '' : String(decimals === undefined ? value : roundTo(value, decimals));
