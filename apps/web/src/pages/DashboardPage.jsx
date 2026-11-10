import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFoods } from '../hooks/useFoods.js';
import { useRides } from '../hooks/useRides.js';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
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
          {done && <span className="visually-hidden"> (done)</span>}
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
              {ride.name || 'Ride plan'} <RideBadges ride={ride} />
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
      <h1>Hi, {user.name.split(' ')[0]}</h1>

      {profileDone && (
        <Link to="/plan" className="btn btn--primary btn--block">
          Plan a ride
        </Link>
      )}

      {!(profileDone && foodCount > 0 && hasRides) && (
        <section className="card">
          <h2>Get ready to ride</h2>
          <ol className="steps">
            <Step done={profileDone} title="Complete your profile">
              {!profileDone && (
                <p>
                  <Link to="/settings">Add your weight</Link> so we can plan your rides.
                </p>
              )}
            </Step>
            <Step done={foodCount > 0} title="Add the foods you eat on the bike">
              <p>
                {foods.isPending ? 'Loading…' : `${foodCount} ${foodCount === 1 ? 'food' : 'foods'} in your library. `}
                <Link to="/foods">{foodCount > 0 ? 'Manage foods' : 'Add your first food'}</Link>
              </p>
            </Step>
            <Step done={hasRides} title="Plan a ride">
              {!hasRides && (
                <p>
                  <Link to="/plan">Plan your first ride</Link> to get an hour-by-hour plan.
                </p>
              )}
            </Step>
          </ol>
        </section>
      )}

      {profileDone && (
        <Link to="/progress" className="card progress-link">
          <span>
            <span className="progress-link__label">Gut training</span>
            <span className="progress-link__value">{user.trainedCarbRateGph} g/hr</span>
          </span>
          <span className="progress-link__cta">See progress →</span>
        </Link>
      )}

      {hasRides && (
        <section className="card" aria-labelledby="recent-rides-title">
          <h2 id="recent-rides-title">Recent rides</h2>
          {recent.length > 0 ? (
            <RideList rides={recent} units={user.units} />
          ) : (
            <p className="muted">No rides on Home. Your archived rides are below.</p>
          )}
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? 'Hide archived rides' : 'Show archived rides'}
          </Button>
          {showArchived && archived.data?.length === 0 && <p className="muted">No archived rides.</p>}
          {showArchived && archived.data?.length > 0 && (
            <section aria-labelledby="archived-rides-title">
              <h3 id="archived-rides-title">Archived</h3>
              <RideList rides={archived.data} units={user.units} />
            </section>
          )}
        </section>
      )}
    </div>
  );
}
