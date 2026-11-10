import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { ForecastNotes, GutTrainingPlan, ProjectionSummary } from '../components/events/EventForecast.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useDeleteEvent, useEvent } from '../hooks/useEvents.js';
import { t } from '../i18n/index.js';
import { formatCountdown, formatDate, formatDuration } from '../lib/format.js';

/** An event's forecast, computed by the API with today's FTP and trained rate. */
export function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const event = useEvent(id);
  const remove = useDeleteEvent();

  if (event.isPending) return <LoadingScreen />;
  if (event.isError) {
    return (
      <div className="page">
        <PageHeader title={t('Event')} backTo="/events" />
        <Notice tone="error">{event.error.status === 404 ? t('That event no longer exists.') : event.error.message}</Notice>
      </div>
    );
  }

  const e = event.data;
  const f = e.forecast;
  const badgeRide = { rideType: e.type, indoor: e.indoor };

  return (
    <div className="page">
      <PageHeader
        title={e.name}
        backTo="/events"
        action={
          <Link to={`/events/${e.id}/edit`} className="btn btn--secondary">
            {t('Edit')}
          </Link>
        }
      />
      <div className="ride-heading">
        <p className="muted">
          {formatDate(e.date)}
          {f && ` · ${formatCountdown(f.gutTraining.daysUntil)} · ${formatDuration(f.durationMin)}`} <RideBadges ride={badgeRide} />
        </p>
        {f && <HourlySummary plan={f.plan} units={user.units} />}
      </div>

      {!f && (
        <Notice tone="error">
          {e.forecastError?.message ?? t("This event's plan can't be worked out right now.")}{' '}
          {e.forecastError?.code === 'PROFILE_INCOMPLETE' && <Link to="/settings">{t('Go to profile')}</Link>}
        </Notice>
      )}

      {f && (
        <>
          <section className="card" aria-label={t('Projected effort')}>
            <ProjectionSummary forecast={f} />
          </section>
          <ForecastNotes forecast={f} />
          <GutTrainingPlan forecast={f} currentGph={user.trainedCarbRateGph} />
          <FuelSummary plan={f.plan} units={user.units} />
          <FuelSchedule schedule={f.plan.schedule} units={user.units} />
        </>
      )}

      <div className="danger-zone">
        {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
        <ConfirmButton
          confirmLabel={t('Tap again to delete')}
          onConfirm={() => remove.mutate(e.id, { onSuccess: () => navigate('/events', { replace: true }) })}
          loading={remove.isPending}
          block
        >
          {t('Delete event')}
        </ConfirmButton>
      </div>
    </div>
  );
}
