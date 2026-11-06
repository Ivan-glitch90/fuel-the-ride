import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFoods } from '../hooks/useFoods.js';
import { useRides } from '../hooks/useRides.js';
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

export function DashboardPage() {
  const { user } = useAuth();
  const foods = useFoods();
  const rides = useRides({ limit: 5 });
  const foodCount = foods.data?.length ?? 0;
  const profileDone = Boolean(user.weightKg);
  const hasRides = (rides.data?.length ?? 0) > 0;

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

      {hasRides && (
        <section className="card">
          <h2>Recent rides</h2>
          <ul className="ride-list">
            {rides.data.map((ride) => (
              <li key={ride.id}>
                <Link to={`/rides/${ride.id}`} className="ride-list__link">
                  <span className="ride-list__name">{ride.name || 'Ride plan'}</span>
                  <span className="muted small">
                    {formatDate(ride.date)} · {formatDuration(ride.durationMin)} · {ride.plan.targets.carbsGph} g carbs/hr
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
