import { t, tCode } from '../../i18n/index.js';
import { formatDuration, formatNumber, intensitySourceLabel } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';
import { Notice } from '../ui/Notice.jsx';

const CONFIDENCE_LABEL = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

/** The plan's per-hour targets (big), whole-ride totals, and any notes or warnings. */
export function FuelSummary({ plan, units }) {
  const { targets, targetTotals, intensity, kcalBurned } = plan;
  const fueledMin = plan.schedule.reduce((sum, b) => sum + b.minutes, 0) || plan.durationMin;
  const sodiumOptional = plan.notes.some((n) => n.code === 'SODIUM_OPTIONAL');
  const confidence = CONFIDENCE_LABEL[intensity.confidence]
    ? t(CONFIDENCE_LABEL[intensity.confidence])
    : `${intensity.confidence} confidence`;

  return (
    <section className="card plan-summary" aria-labelledby="plan-summary-title">
      <h2 id="plan-summary-title">{t('Every hour')}</h2>
      <dl className="targets">
        <div className="targets__item">
          <dt>{t('Carbs')}</dt>
          <dd>{targets.carbsGph} g</dd>
        </div>
        <div className="targets__item">
          <dt>{t('Fluid')}</dt>
          <dd>{formatFluid(targets.fluidMlPerHr, units)}</dd>
        </div>
        <div className="targets__item">
          <dt>{t('Sodium')}</dt>
          <dd>{sodiumOptional ? t('Optional') : `${targets.sodiumMgPerHr} mg`}</dd>
        </div>
      </dl>

      <p className="plan-summary__totals">
        {t('Whole ride ({duration}): {carbs} g carbs · {fluid} fluid', {
          duration: formatDuration(fueledMin),
          carbs: formatNumber(targetTotals.carbsG),
          fluid: formatFluid(targetTotals.fluidMl, units),
        })}
        {targetTotals.sodiumMg > 0 && t(' · {sodium} mg sodium', { sodium: formatNumber(targetTotals.sodiumMg) })}
      </p>
      <p className="muted small">
        {t('Burns about {kcal} kcal. Based on your {source} ({confidence}).', {
          kcal: formatNumber(kcalBurned),
          source: intensitySourceLabel(intensity.source),
          confidence,
        })}
      </p>

      {plan.warnings.map((w) => (
        <Notice key={w.message} tone="warning">
          {tCode(w.code, w.message, w.params)}
        </Notice>
      ))}
      {plan.notes
        .filter((n) => n.code !== 'SODIUM_OPTIONAL')
        .map((n) => (
          <Notice key={n.code}>{tCode(n.code, n.message, n.params)}</Notice>
        ))}
    </section>
  );
}
