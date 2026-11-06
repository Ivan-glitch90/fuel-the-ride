import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFoods } from '../hooks/useFoods.js';

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
  const foodCount = foods.data?.length ?? 0;
  const profileDone = Boolean(user.weightKg);

  return (
    <div className="page">
      <h1>Hi, {user.name.split(' ')[0]}</h1>

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
          <Step done={false} title="Plan a ride">
            <p className="muted">Coming next.</p>
          </Step>
        </ol>
      </section>
    </div>
  );
}
