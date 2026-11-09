import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { SCORES } from '../components/rides/CheckInForm.jsx';
import { IntakeLogger } from '../components/rides/IntakeLogger.jsx';
import { Suggestions } from '../components/rides/Suggestions.jsx';
import { Button } from '../components/ui/Button.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useCheckIn } from '../hooks/useCheckIns.js';
import { useFoods } from '../hooks/useFoods.js';
import { useRide, useUpdateRide } from '../hooks/useRides.js';
import { formatDate, formatDuration } from '../lib/format.js';
import { cToDisplay, tempUnit } from '../lib/units.js';

function CheckInCard({ rideId, checkIn, user }) {
  if (!checkIn) {
    return (
      <section className="card" aria-labelledby="checkin-title">
        <h2 id="checkin-title">Check-in</h2>
        <p>How did your stomach, energy and legs feel? It takes 30 seconds and makes your next plans smarter.</p>
        <Link to={`/rides/${rideId}/check-in`} className="btn btn--primary btn--block">
          Check in
        </Link>
      </section>
    );
  }
  return (
    <>
      <section className="card" aria-labelledby="checkin-title">
        <h2 id="checkin-title">Check-in</h2>
        <dl className="scores">
          {SCORES.map((s) => (
            <div key={s.key} className="scores__item">
              <dt>{s.label}</dt>
              <dd>{checkIn[s.key]}/5</dd>
            </div>
          ))}
        </dl>
        {(checkIn.bonked || checkIn.cramped) && (
          <p>{[checkIn.bonked && 'Bonked', checkIn.cramped && 'Cramped'].filter(Boolean).join(' · ')}</p>
        )}
        {checkIn.notes && <p className="muted">“{checkIn.notes}”</p>}
        <Link to={`/rides/${rideId}/check-in`} className="btn btn--secondary btn--block">
          Edit check-in
        </Link>
      </section>
      <Suggestions checkIn={checkIn} user={user} />
    </>
  );
}

/** A saved ride: the plan as it was saved, what you ate, and the check-in. */
export function RideDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const ride = useRide(id);
  const foods = useFoods({ archived: 'all' }); // logged foods may have been archived since
  const checkIn = useCheckIn(id);
  const update = useUpdateRide();

  if (ride.isPending) return <LoadingScreen />;
  if (ride.isError) {
    return (
      <div className="page">
        <PageHeader title="Ride" backTo="/" />
        <Notice tone="error">{ride.error.status === 404 ? 'That ride no longer exists.' : ride.error.message}</Notice>
      </div>
    );
  }

  const r = ride.data;
  const details = [formatDate(r.date), formatDuration(r.durationMin)];
  if (r.tempC !== undefined && r.tempC !== null) details.push(`${cToDisplay(r.tempC, user.units)}${tempUnit(user.units)}`);

  return (
    <div className="page">
      <PageHeader title={r.name || 'Ride plan'} backTo="/" />
      <div className="ride-heading">
        <p className="muted">
          {details.join(' · ')} <RideBadges ride={r} />
        </p>
        <HourlySummary plan={r.plan} units={user.units} />
      </div>
      <FuelSummary plan={r.plan} units={user.units} />
      <FuelSchedule schedule={r.plan.schedule} units={user.units} />
      {r.status === 'planned' && (
        <div>
          <Button
            variant="ghost"
            block
            loading={update.isPending && !('intake' in (update.variables?.patch ?? {}))}
            // Re-sending the food choice makes the API re-plan with today's rules, profile and food values
            // (app-picked rides also re-pick from the current library)
            onClick={() =>
              update.mutate({ id: r.id, patch: r.foodsAuto ? { foodsAuto: true } : { foodIds: r.foodIds ?? [] } })
            }
          >
            Recalculate plan
          </Button>
          <p className="muted small">Uses your current profile, food values and the latest fueling rules.</p>
        </div>
      )}

      <h2 className="section-title">After the ride</h2>
      {foods.data && (
        <IntakeLogger
          key={r.updatedAt}
          ride={r}
          foods={foods.data}
          units={user.units}
          onSave={(patch) => update.mutate({ id: r.id, patch })}
          saving={update.isPending}
          error={update.error}
        />
      )}
      {!checkIn.isPending && <CheckInCard rideId={r.id} checkIn={checkIn.data} user={user} />}
    </div>
  );
}
