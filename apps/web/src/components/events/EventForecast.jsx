import { formatShortDate } from '../../lib/format.js';
import { HourlySummary } from '../plan/HourlySummary.jsx';
import { Notice } from '../ui/Notice.jsx';

/** "Last time 210 W at FTP 250 → today ≈ 227 W" */
export function ProjectionSummary({ forecast }) {
  const p = forecast.projection;
  if (p.basis === 'hr') {
    return <p>Planned from last time&apos;s average heart rate of {p.intensity.avgHr} bpm.</p>;
  }
  const projected = Math.round(p.intensity.avgPowerW);
  if (p.ftpRatio === 1 && (!p.pastFtpW || !p.currentFtpW)) {
    return <p>Planned at last time&apos;s {projected} W average.</p>;
  }
  return (
    <p>
      Last time: <strong>{Math.round(p.pastAvgPowerW)} W</strong> average at FTP {p.pastFtpW} W. With today&apos;s FTP of{' '}
      {p.currentFtpW} W, the same effort is about <strong>{projected} W</strong>.
    </p>
  );
}

/** Week-by-week practice rates up to race week, then hold. */
export function GutTrainingPlan({ forecast, currentGph }) {
  const { gutTraining: g, goalGph } = forecast;
  return (
    <section className="card" aria-labelledby="gut-training-title">
      <h2 id="gut-training-title">Gut training build-up</h2>
      <p>
        Race-day goal <strong>{goalGph} g/hr</strong>. Your stomach handles <strong>{currentGph} g/hr</strong> today.
      </p>
      {g.weeks.length > 0 ? (
        <ol className="ramp">
          {g.weeks.map((w) => (
            <li key={w.week} className="ramp__week">
              <span className="ramp__label">
                Week {w.week} <span className="muted">· from {formatShortDate(w.startDate)}</span>
              </span>
              <span className="ramp__rate">{w.targetGph} g/hr</span>
              <span className="ramp__hint muted small">Practice this on your longest ride of the week</span>
            </li>
          ))}
          <li className="ramp__week ramp__week--hold">
            <span className="ramp__label">Race week</span>
            <span className="ramp__rate">{g.raceDayGph} g/hr</span>
            <span className="ramp__hint muted small">Hold steady. Nothing new before race day.</span>
          </li>
        </ol>
      ) : (
        <p className="muted">
          {g.daysUntil < 7
            ? 'Less than a week to go: no time to build up. Race day uses what your stomach handles now.'
            : 'You already handle the race-day goal. Keep practicing it on long rides.'}
        </p>
      )}
      <p className="muted small">
        Your trained rate only changes when you accept a suggestion after a check-in, so the build-up is guidance to practice.
      </p>
    </section>
  );
}

/** The event's forecast notes (goal not reachable, FTP unknown, last time ran low…). */
export function ForecastNotes({ forecast }) {
  return forecast.notes.map((n) => (
    <Notice key={n.code} tone={n.code === 'GOAL_NOT_REACHABLE' ? 'warning' : 'info'}>
      {n.message}
    </Notice>
  ));
}

export function EventHourly({ forecast, units }) {
  return <HourlySummary plan={forecast.plan} units={units} />;
}
