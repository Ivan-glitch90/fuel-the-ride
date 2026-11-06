import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { PlusIcon } from '../components/ui/icons.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useEvents } from '../hooks/useEvents.js';
import { formatCountdown, formatDate } from '../lib/format.js';

function EventList({ events, units, label }) {
  return (
    <ul className="list" aria-label={label}>
      {events.map((e) => (
        <li key={e.id} className="card">
          <Link to={`/events/${e.id}`} className="ride-list__link">
            <span className="ride-list__name">
              {e.name} <RideBadges ride={{ rideType: e.type, indoor: e.indoor }} />
            </span>
            <span className="muted small">
              {formatDate(e.date)}
              {e.forecast && ` · ${formatCountdown(e.forecast.gutTraining.daysUntil)}`}
            </span>
            {e.forecast ? (
              <HourlySummary plan={e.forecast.plan} units={units} />
            ) : (
              <span className="muted small">{e.forecastError?.message}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Upcoming races and group rides, each planned from last time's data. */
export function EventsPage() {
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);
  const upcoming = useEvents('upcoming');
  const past = useEvents('past', { enabled: showPast });

  return (
    <div className="page">
      <PageHeader
        title="Events"
        action={
          <Link to="/events/new" className="btn btn--primary">
            <PlusIcon /> Add event
          </Link>
        }
      />
      <p className="muted">
        Races and group rides: plan from last time&apos;s numbers, scaled to today&apos;s FTP, with a gut-training
        build-up to race day.
      </p>

      {upcoming.isPending && <LoadingScreen />}
      {upcoming.isError && <Notice tone="error">{upcoming.error.message}</Notice>}
      {upcoming.data?.length === 0 && (
        <div className="empty">
          <p>No upcoming events.</p>
          <Link to="/events/new" className="btn btn--primary">
            Add your next race or group ride
          </Link>
        </div>
      )}
      {upcoming.data?.length > 0 && <EventList events={upcoming.data} units={user.units} label="Upcoming events" />}

      <button type="button" className="btn btn--ghost" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
        {showPast ? 'Hide past events' : 'Show past events'}
      </button>
      {showPast && past.data?.length === 0 && <p className="muted">No past events.</p>}
      {showPast && past.data?.length > 0 && <EventList events={past.data} units={user.units} label="Past events" />}
    </div>
  );
}
