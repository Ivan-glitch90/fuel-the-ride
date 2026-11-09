import { useState } from 'react';
import { Link } from 'react-router';
import { CarbRateChart } from '../components/charts/CarbRateChart.jsx';
import { EnergyBalanceChart } from '../components/charts/EnergyBalanceChart.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { useProgress } from '../hooks/useProgress.js';

const RANGES = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 0, label: 'All' },
];
/**
 * Start of the day `days` ago (local time). It must be stable all day: it's part of the query key,
 * so a value that changed on every render would refetch endlessly.
 */
function fromForRange(days) {
  if (!days) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function StatTile({ label, value, delta }) {
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">{value}</p>
      {delta && <p className={`stat-tile__delta stat-tile__delta--${delta.tone}`}>{delta.text}</p>}
    </div>
  );
}

/** /progress: gut training over time and calories burned vs eaten (docs/PRODUCT.md §6.6). */
export function ProgressPage() {
  const [days, setDays] = useState(90);
  const progress = useProgress({ from: fromForRange(days) });

  if (progress.isPending) return <LoadingScreen />;
  if (progress.isError) return <Notice tone="error">{progress.error.message}</Notice>;

  const { current, carbRate, energyBalance } = progress.data;
  const firstRate = carbRate[0]?.trainedGph;
  const change = firstRate === undefined ? 0 : current.trainedGph - firstRate;
  const covered = energyBalance.length
    ? Math.round(
        (energyBalance.reduce((s, r) => s + r.kcalEaten, 0) / energyBalance.reduce((s, r) => s + r.kcalBurned, 0)) * 100,
      )
    : null;

  return (
    <div className="page">
      <PageHeader title="Progress" backTo="/" />
      {/* One filter row above everything it scopes */}
      <SegmentedControl label="Show" options={RANGES} value={days} onChange={setDays} />

      <div className={`kpi-row ${progress.isPlaceholderData ? 'is-refreshing' : ''}`}>
        <StatTile
          label="Carb rate"
          value={`${current.trainedGph} g/hr`}
          delta={
            change !== 0
              ? { text: `${change > 0 ? '+' : ''}${change} since ${fmtDay(carbRate[0].date)}`, tone: change > 0 ? 'good' : 'neutral' }
              : undefined
          }
        />
        <StatTile label="Check-ins" value={String(carbRate.length)} />
        <StatTile label="Eaten vs burned" value={covered === null ? '—' : `${covered}%`} />
      </div>

      <section className={`card ${progress.isPlaceholderData ? 'is-refreshing' : ''}`} aria-labelledby="carb-chart-title">
        <h2 id="carb-chart-title">Gut training</h2>
        <p className="muted small">The carbs per hour your stomach handles, and what you ate on each ride.</p>
        {carbRate.length > 0 ? (
          <CarbRateChart points={carbRate} currentGph={current.trainedGph} />
        ) : (
          <p className="muted">
            No check-ins in this period. <Link to="/">Check in after your rides</Link> to see your gut training here.
          </p>
        )}
      </section>

      <section className={`card ${progress.isPlaceholderData ? 'is-refreshing' : ''}`} aria-labelledby="energy-chart-title">
        <h2 id="energy-chart-title">Calories burned vs eaten</h2>
        <p className="muted small">Per ride where you logged what you ate.</p>
        {energyBalance.length > 0 ? (
          <EnergyBalanceChart rides={energyBalance} />
        ) : (
          <p className="muted">No logged rides in this period. Log what you ate on a ride to see it here.</p>
        )}
      </section>
    </div>
  );
}
