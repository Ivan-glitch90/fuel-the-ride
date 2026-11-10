import { t, tCode, tx } from '../../i18n/index.js';
import { formatServings } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';

const blockTitle = (block) =>
  block.minutes === 60
    ? t('Hour {hour}', { hour: block.hour })
    : t('Hour {hour} · last {minutes} min', { hour: block.hour, minutes: block.minutes });

/** One card per hour: what to eat and drink, with the "spread across the hour" reminder. */
export function FuelSchedule({ schedule, units }) {
  if (schedule.length === 0) return null;
  return (
    <section aria-labelledby="schedule-title">
      <h2 id="schedule-title">{t('Hour by hour')}</h2>
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
                  {tx(
                    '<b>{amount}</b> water',
                    { b: (text) => <strong>{text}</strong> },
                    { amount: formatFluid(block.plainWaterMl, units) },
                  )}
                </li>
              )}
            </ul>
            <p className="hour-card__totals">
              {t('{carbs} g carbs · {fluid} · {sodium} mg sodium', {
                carbs: block.carbsG,
                fluid: formatFluid(block.fluidMl, units),
                sodium: block.sodiumMg,
              })}
            </p>
            <p className="hour-card__note">{tCode('SPREAD_NOTE', block.note)}</p>
            {block.warnings.length > 0 && (
              <ul className="hour-card__warnings">
                {block.warnings.map((w) => (
                  <li key={w.code}>{tCode(w.code, w.message, w.params)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
