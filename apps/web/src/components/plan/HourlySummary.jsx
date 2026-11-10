import { carryList } from '@fuel-ride/fuel-core';
import { t } from '../../i18n/index.js';
import { formatServings } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';

/** "1 × Oat bar, ½ × First endurance, 200 ml water" */
function itemsText(items, plainWaterMl, units) {
  return [
    ...items.map((i) => `${formatServings(i.servings)} × ${i.name}`),
    plainWaterMl > 0 && t('{amount} water', { amount: formatFluid(plainWaterMl, units) }),
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * The lines a rider needs before rolling out:
 *  - Carry: everything to pack for the whole ride (FUELING_RULES.md §7.5)
 *  - Each hour: what to eat and drink (first hour; every full hour is planned the same way)
 *  - per-hour targets
 */
export function HourlySummary({ plan, units }) {
  const first = plan.schedule[0];
  const carry = carryList(plan);
  const sodiumOptional = plan.notes.some((n) => n.code === 'SODIUM_OPTIONAL');
  const lead = !first || first.minutes === 60 ? t('Each hour:') : t('For the ride:');
  const { carbsGph, fluidMlPerHr, sodiumMgPerHr } = plan.targets;

  return (
    <div className="hourly-summary">
      {carry.items.length > 0 && (
        <p className="hourly-summary__carry">
          <strong>{t('Carry:')}</strong> {itemsText(carry.items, carry.plainWaterMl, units)}
        </p>
      )}
      {first && first.items.length > 0 && (
        <p className="hourly-summary__eat">
          <strong>{lead}</strong> {itemsText(first.items, first.plainWaterMl, units)}
        </p>
      )}
      <p className="hourly-summary__targets">
        {t('{carbs} g carbs · {fluid} · {sodium} per hour', {
          carbs: carbsGph,
          fluid: formatFluid(fluidMlPerHr, units),
          sodium: sodiumOptional ? t('sodium optional') : t('{mg} mg sodium', { mg: sodiumMgPerHr }),
        })}
      </p>
    </div>
  );
}

const RIDE_TYPE_LABEL = { group: 'Group ride', race: 'Race' }; // rides and events share these

/** Small labels for the ride: Race / Group ride / Indoor. */
export function RideBadges({ ride }) {
  const labels = [
    RIDE_TYPE_LABEL[ride.rideType] && t(RIDE_TYPE_LABEL[ride.rideType]),
    ride.indoor && t('Indoor'),
    ride.archived && t('Archived'),
  ].filter(Boolean);
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
