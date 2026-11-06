import { useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useRide } from '../hooks/useRides.js';
import { formatDate, formatDuration } from '../lib/format.js';
import { cToDisplay, tempUnit } from '../lib/units.js';

/** A saved ride: the plan exactly as it was saved (later food edits don't change it). */
export function RideDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const ride = useRide(id);

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
      {location.state?.saved && <Notice tone="success">Ride plan saved.</Notice>}
      <FuelSummary plan={r.plan} units={user.units} />
      <FuelSchedule schedule={r.plan.schedule} units={user.units} />
      <p className="muted small">Logging what you ate and the post-ride check-in are coming next.</p>
    </div>
  );
}
