import { t, tCode, tx } from '../../i18n/index.js';
import { formatShortDate } from '../../lib/format.js';
import { HourlySummary } from '../plan/HourlySummary.jsx';
import { Notice } from '../ui/Notice.jsx';

const strong = (text) => <strong>{text}</strong>;

/** "Last time 210 W at FTP 250 → today ≈ 227 W" */
export function ProjectionSummary({ forecast }) {
  const p = forecast.projection;
  if (p.basis === 'hr') {
    return <p>{t("Planned from last time's average heart rate of {hr} bpm.", { hr: p.intensity.avgHr })}</p>;
  }
  const projected = Math.round(p.intensity.avgPowerW);
  if (p.ftpRatio === 1 && (!p.pastFtpW || !p.currentFtpW)) {
    return <p>{t("Planned at last time's {watts} W average.", { watts: projected })}</p>;
  }
  return (
    <p>
      {tx(
        "Last time: <b>{pastW} W</b> average at FTP {pastFtp} W. With today's FTP of {currentFtp} W, the same effort is about <b>{projectedW} W</b>.",
        { b: strong },
        { pastW: Math.round(p.pastAvgPowerW), pastFtp: p.pastFtpW, currentFtp: p.currentFtpW, projectedW: projected },
      )}
    </p>
  );
}

/** Week-by-week practice rates up to race week, then hold. */
export function GutTrainingPlan({ forecast, currentGph }) {
  const { gutTraining: g, goalGph } = forecast;
  return (
    <section className="card" aria-labelledby="gut-training-title">
      <h2 id="gut-training-title">{t('Gut training build-up')}</h2>
      <p>
        {tx(
          'Race-day goal <b>{goal} g/hr</b>. Your stomach handles <b>{current} g/hr</b> today.',
          { b: strong },
          { goal: goalGph, current: currentGph },
        )}
      </p>
      {g.weeks.length > 0 ? (
        <ol className="ramp">
          {g.weeks.map((w) => (
            <li key={w.week} className="ramp__week">
              <span className="ramp__label">
                {t('Week {week}', { week: w.week })}{' '}
                <span className="muted">{t('· from {date}', { date: formatShortDate(w.startDate) })}</span>
              </span>
              <span className="ramp__rate">{t('{rate} g/hr', { rate: w.targetGph })}</span>
              <span className="ramp__hint muted small">{t('Practice this on your longest ride of the week')}</span>
            </li>
          ))}
          <li className="ramp__week ramp__week--hold">
            <span className="ramp__label">{t('Race week')}</span>
            <span className="ramp__rate">{t('{rate} g/hr', { rate: g.raceDayGph })}</span>
            <span className="ramp__hint muted small">{t('Hold steady. Nothing new before race day.')}</span>
          </li>
        </ol>
      ) : (
        <p className="muted">
          {g.daysUntil < 7
            ? t('Less than a week to go: no time to build up. Race day uses what your stomach handles now.')
            : t('You already handle the race-day goal. Keep practicing it on long rides.')}
        </p>
      )}
      <p className="muted small">
        {t(
          'Your trained rate only changes when you accept a suggestion after a check-in, so the build-up is guidance to practice.',
        )}
      </p>
    </section>
  );
}

/** The event's forecast notes (goal not reachable, FTP unknown, last time ran low…). */
export function ForecastNotes({ forecast }) {
  return forecast.notes.map((n) => (
    <Notice key={n.code} tone={n.code === 'GOAL_NOT_REACHABLE' ? 'warning' : 'info'}>
      {tCode(n.code, n.message, n.params)}
    </Notice>
  ));
}

export function EventHourly({ forecast, units }) {
  return <HourlySummary plan={forecast.plan} units={units} />;
}
