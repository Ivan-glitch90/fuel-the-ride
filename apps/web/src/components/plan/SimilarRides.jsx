import { Link } from 'react-router';
import { useSimilarRides } from '../../hooks/useRides.js';
import { t } from '../../i18n/index.js';
import { formatDate, formatDuration, formatServings } from '../../lib/format.js';

/**
 * "Rides like this" (FUELING_RULES.md §9B): past rides with a similar duration and effort, what
 * you ate per hour, and how it went. One tap plans with the same foods. Only shows when there's
 * something to learn from.
 */
export function SimilarRides({ plan, durationMin, library, onUseFoods }) {
  const target = plan && durationMin ? { durationMin, kcalPerHour: plan.kcalBurned / (durationMin / 60) } : null;
  const similar = useSimilarRides(target);
  const rides = similar.data ?? [];
  if (!target || rides.length === 0) return null;

  const available = new Set(library.map((f) => f.id)); // archived foods can't be planned with
  return (
    <section className="card" aria-labelledby="similar-title">
      <h2 id="similar-title">{t('Rides like this')}</h2>
      <p className="muted small">{t('Past rides with a similar duration and effort, and what you ate.')}</p>
      <ul className="similar">
        {rides.map((ride) => {
          const foodIds = ride.perHour.map((p) => p.foodId).filter((id) => available.has(id));
          return (
            <li key={ride.id} className="similar__ride">
              <Link to={`/rides/${ride.id}`} className="similar__title">
                {ride.name || t('Ride plan')}
              </Link>
              {ride.worked && <span className="badge similar__badge">{t('Worked well')}</span>}
              <p className="muted small">
                {formatDate(ride.date)} · {formatDuration(ride.durationMin)} ·{' '}
                {t('ate {carbs} g/hr', { carbs: ride.carbsGph })}
              </p>
              {ride.perHour.length > 0 && (
                <p>
                  {t('Per hour: {foods}', {
                    foods: ride.perHour.map((p) => `${formatServings(p.servings)} × ${p.name}`).join(', '),
                  })}
                </p>
              )}
              <p className="small">
                {ride.checkIn
                  ? t('Stomach {gi}/5 · Energy {energy}/5', { gi: ride.checkIn.giScore, energy: ride.checkIn.energyScore }) +
                    (ride.checkIn.bonked ? ` · ${t('Bonked')}` : '')
                  : t('No check-in')}
              </p>
              {foodIds.length > 0 && (
                <button type="button" className="btn btn--ghost" onClick={() => onUseFoods(foodIds)}>
                  {t('Plan with these foods')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
