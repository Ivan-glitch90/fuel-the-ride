import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFoods } from '../hooks/useFoods.js';
import { useRides } from '../hooks/useRides.js';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { t, tn, tx } from '../i18n/index.js';
import { formatDate, formatDuration } from '../lib/format.js';

function Step({ done, title, children }) {
  return (
    <li className={`step ${done ? 'step--done' : ''}`}>
      <span className="step__mark" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      <div>
        <p className="step__title">
          {title}
          {done && <span className="visually-hidden"> ({t('done')})</span>}
        </p>
        {children}
      </div>
    </li>
  );
}

function RideList({ rides, units }) {
  return (
    <ul className="ride-list">
      {rides.map((ride) => (
        <li key={ride.id}>
          <Link to={`/rides/${ride.id}`} className="ride-list__link">
            <span className="ride-list__name">
              {ride.name || t('Ride plan')} <RideBadges ride={ride} />
            </span>
            <span className="muted small">
              {formatDate(ride.date)} · {formatDuration(ride.durationMin)}
            </span>
            <HourlySummary plan={ride.plan} units={units} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const foods = useFoods();
  const rides = useRides({ limit: 5 }); // archived rides stay out of the way
  const anyRide = useRides({ archived: 'all', limit: 1 }); // "Plan a ride" step: archived rides count as done
  const archived = useRides({ archived: 'true', limit: 20 }, { enabled: showArchived });
  const foodCount = foods.data?.length ?? 0;
  const profileDone = Boolean(user.weightKg);
  const hasRides = (anyRide.data?.length ?? 0) > 0;
  const recent = rides.data ?? [];

  return (
    <div className="page">
      <h1>{t('Hi, {name}', { name: user.name.split(' ')[0] })}</h1>

      {profileDone && (
        <Link to="/plan" className="btn btn--primary btn--block">
          {t('Plan a ride')}
        </Link>
      )}

      {!(profileDone && foodCount > 0 && hasRides) && (
        <section className="card">
          <h2>{t('Get ready to ride')}</h2>
          <ol className="steps">
            <Step done={profileDone} title={t('Complete your profile')}>
              {!profileDone && (
                <p>
                  {tx('<link>Add your weight</link> so we can plan your rides.', {
                    link: (text) => <Link to="/settings">{text}</Link>,
                  })}
                </p>
              )}
            </Step>
            <Step done={foodCount > 0} title={t('Add the foods you eat on the bike')}>
              <p>
                {foods.isPending
                  ? t('Loading…')
                  : `${tn('{n} food in your library.', '{n} foods in your library.', foodCount)} `}
                <Link to="/foods">{foodCount > 0 ? t('Manage foods') : t('Add your first food')}</Link>
              </p>
            </Step>
            <Step done={hasRides} title={t('Plan a ride')}>
              {!hasRides && (
                <p>
                  {tx('<link>Plan your first ride</link> to get an hour-by-hour plan.', {
                    link: (text) => <Link to="/plan">{text}</Link>,
                  })}
                </p>
              )}
            </Step>
          </ol>
        </section>
      )}

      {profileDone && (
        <Link to="/progress" className="card progress-link">
          <span>
            <span className="progress-link__label">{t('Gut training')}</span>
            <span className="progress-link__value">{t('{rate} g/hr', { rate: user.trainedCarbRateGph })}</span>
          </span>
          <span className="progress-link__cta">{t('See progress →')}</span>
        </Link>
      )}

      {hasRides && (
        <section className="card" aria-labelledby="recent-rides-title">
          <h2 id="recent-rides-title">{t('Recent rides')}</h2>
          {recent.length > 0 ? (
            <RideList rides={recent} units={user.units} />
          ) : (
            <p className="muted">{t('No rides on Home. Your archived rides are below.')}</p>
          )}
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? t('Hide archived rides') : t('Show archived rides')}
          </Button>
          {showArchived && archived.data?.length === 0 && <p className="muted">{t('No archived rides.')}</p>}
          {showArchived && archived.data?.length > 0 && (
            <section aria-labelledby="archived-rides-title">
              <h3 id="archived-rides-title">{t('Archived rides')}</h3>
              <RideList rides={archived.data} units={user.units} />
            </section>
          )}
        </section>
      )}
    </div>
  );
}
