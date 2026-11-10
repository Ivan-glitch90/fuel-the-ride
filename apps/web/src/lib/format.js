// Display helpers for plans and rides. Dates and numbers follow the app language (src/i18n).
import { getLocale, t, tn } from '../i18n/index.js';

/** 135 → "2 h 15 min", 120 → "2 h", 45 → "45 min" (the same in English and Spanish) */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** 0.5 → "½", 1.5 → "1½", 2 → "2" */
export function formatServings(servings) {
  const whole = Math.floor(servings);
  const half = servings - whole >= 0.5;
  if (whole === 0) return half ? '½' : '0';
  return `${whole}${half ? '½' : ''}`;
}

/** 1575 → "1,575" */
export const formatNumber = (value) => Math.round(value).toLocaleString(getLocale());

/** "2026-11-03T12:00:00.000Z" → "Tue, Nov 3, 2026" / "mar, 3 nov 2026" */
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(getLocale(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Today as YYYY-MM-DD in the rider's own time zone (for <input type="date">). */
export const todayInputValue = () => new Date().toLocaleDateString('en-CA');

/** YYYY-MM-DD → ISO at local midday, so the date never shifts across time zones. */
export const dateInputToIso = (value) => new Date(`${value}T12:00:00`).toISOString();

/** Days until an event → "today", "tomorrow", "in 5 days", "in 6 weeks", "3 days ago". */
export function formatCountdown(daysUntil) {
  if (daysUntil === 0) return t('today');
  if (daysUntil === 1) return t('tomorrow');
  if (daysUntil < 0) return tn('{n} day ago', '{n} days ago', -daysUntil);
  if (daysUntil < 14) return tn('in {n} day', 'in {n} days', daysUntil);
  return tn('in {n} week', 'in {n} weeks', Math.floor(daysUntil / 7));
}

/** YYYY-MM-DD `days` from today, in the rider's own time zone. */
export const inputDateInDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

/** ISO date → YYYY-MM-DD in the rider's own time zone (for <input type="date">). */
export const isoToDateInput = (iso) => new Date(iso).toLocaleDateString('en-CA');

/** "2026-11-13" → "Nov 13" / "13 nov" */
export const formatShortDate = (ymd) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });

const INTENSITY_SOURCE_LABEL = {
  kj: 'kilojoules',
  power: 'average power',
  hr: 'average heart rate',
  'power-zone': 'power zone',
  'hr-zone': 'heart-rate zone',
};
/** How the effort was measured, in the app language ("average power" / "potencia promedio"). */
export const intensitySourceLabel = (source) => t(INTENSITY_SOURCE_LABEL[source] ?? source);
