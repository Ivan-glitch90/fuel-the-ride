import { formatDuration, formatNumber, INTENSITY_SOURCE_LABEL } from '../../lib/format.js';
import { formatFluid } from '../../lib/units.js';
import { Notice } from '../ui/Notice.jsx';

/** The plan's per-hour targets (big), whole-ride totals, and any notes or warnings. */
export function FuelSummary({ plan, units }) {
  const { targets, targetTotals, intensity, kcalBurned } = plan;
  const fueledMin = plan.schedule.reduce((sum, b) => sum + b.minutes, 0) || plan.durationMin;
  const sodiumOptional = plan.notes.some((n) => n.code === 'SODIUM_OPTIONAL');

  return (
    <section className="card plan-summary" aria-labelledby="plan-summary-title">
      <h2 id="plan-summary-title">Every hour</h2>
      <dl className="targets">
        <div className="targets__item">
          <dt>Carbs</dt>
          <dd>{targets.carbsGph} g</dd>
        </div>
        <div className="targets__item">
          <dt>Fluid</dt>
          <dd>{formatFluid(targets.fluidMlPerHr, units)}</dd>
        </div>
        <div className="targets__item">
          <dt>Sodium</dt>
          <dd>{sodiumOptional ? 'Optional' : `${targets.sodiumMgPerHr} mg`}</dd>
        </div>
      </dl>

      <p className="plan-summary__totals">
        Whole ride ({formatDuration(fueledMin)}): {formatNumber(targetTotals.carbsG)} g carbs ·{' '}
        {formatFluid(targetTotals.fluidMl, units)} fluid
        {targetTotals.sodiumMg > 0 && ` · ${formatNumber(targetTotals.sodiumMg)} mg sodium`}
      </p>
      <p className="muted small">
        Burns about {formatNumber(kcalBurned)} kcal. Based on your {INTENSITY_SOURCE_LABEL[intensity.source]} (
        {intensity.confidence} confidence).
      </p>

      {plan.warnings.map((w) => (
        <Notice key={w.message} tone="warning">
          {w.message}
        </Notice>
      ))}
      {plan.notes
        .filter((n) => n.code !== 'SODIUM_OPTIONAL')
        .map((n) => (
          <Notice key={n.code}>{n.message}</Notice>
        ))}
    </section>
  );
}
