// Display helpers for plans and rides.

/** 135 → "2 h 15 min", 120 → "2 h", 45 → "45 min" */
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
export const formatNumber = (value) => Math.round(value).toLocaleString('en-US');

/** "2026-11-03T12:00:00.000Z" → "Tue, Nov 3, 2026" */
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Today as YYYY-MM-DD in the rider's own time zone (for <input type="date">). */
export const todayInputValue = () => new Date().toLocaleDateString('en-CA');

/** YYYY-MM-DD → ISO at local midday, so the date never shifts across time zones. */
export const dateInputToIso = (value) => new Date(`${value}T12:00:00`).toISOString();

export const INTENSITY_SOURCE_LABEL = {
  kj: 'kilojoules',
  power: 'average power',
  hr: 'average heart rate',
  'power-zone': 'power zone',
  'hr-zone': 'heart-rate zone',
};
