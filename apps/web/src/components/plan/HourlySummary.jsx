import { formatServings } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';

/**
 * The one line a rider needs before rolling out: what to eat each hour, and the per-hour targets.
 * Uses the first hour of the schedule (every full hour is planned the same way).
 */
export function HourlySummary({ plan, units }) {
  const first = plan.schedule[0];
  const items = first
    ? [
        ...first.items.map((i) => `${formatServings(i.servings)} × ${i.name}`),
        first.plainWaterMl > 0 && `${formatFluid(first.plainWaterMl, units)} water`,
      ].filter(Boolean)
    : [];
  const sodiumOptional = plan.notes.some((n) => n.code === 'SODIUM_OPTIONAL');
  const lead = !first || first.minutes === 60 ? 'Each hour' : 'For the ride';
  const { carbsGph, fluidMlPerHr, sodiumMgPerHr } = plan.targets;

  return (
    <div className="hourly-summary">
      {items.length > 0 && (
        <p className="hourly-summary__eat">
          <strong>{lead}:</strong> {items.join(', ')}
        </p>
      )}
      <p className="hourly-summary__targets">
        {carbsGph} g carbs · {formatFluid(fluidMlPerHr, units)} · {sodiumOptional ? 'sodium optional' : `${sodiumMgPerHr} mg sodium`}{' '}
        per hour
      </p>
    </div>
  );
}

const RIDE_TYPE_LABEL = { group: 'Group ride', race: 'Race' }; // rides and events share these

/** Small labels for the ride: Race / Group ride / Indoor. */
export function RideBadges({ ride }) {
  const labels = [RIDE_TYPE_LABEL[ride.rideType], ride.indoor && 'Indoor'].filter(Boolean);
  if (labels.length === 0) return null;
  return (
    <span className="ride-badges">
      {labels.map((label) => (
        <span key={label} className="badge">
          {label}
        </span>
      ))}
    </span>
  );
}
