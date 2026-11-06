import { formatServings } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';

const blockTitle = (block) =>
  block.minutes === 60 ? `Hour ${block.hour}` : `Hour ${block.hour} · last ${block.minutes} min`;

/** One card per hour: what to eat and drink, with the "spread across the hour" reminder. */
export function FuelSchedule({ schedule, units }) {
  if (schedule.length === 0) return null;
  return (
    <section aria-labelledby="schedule-title">
      <h2 id="schedule-title">Hour by hour</h2>
      <ol className="schedule">
        {schedule.map((block) => (
          <li key={block.hour} className="card hour-card">
            <h3 className="hour-card__title">{blockTitle(block)}</h3>
            <ul className="hour-card__items">
              {block.items.map((item) => (
                <li key={item.foodId}>
                  <strong>{formatServings(item.servings)} ×</strong> {item.name}
                </li>
              ))}
              {block.plainWaterMl > 0 && (
                <li>
                  <strong>{formatFluid(block.plainWaterMl, units)}</strong> water
                </li>
              )}
            </ul>
            <p className="hour-card__totals">
              {block.carbsG} g carbs · {formatFluid(block.fluidMl, units)} · {block.sodiumMg} mg sodium
            </p>
            <p className="hour-card__note">{block.note}</p>
            {block.warnings.length > 0 && (
              <ul className="hour-card__warnings">
                {block.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
