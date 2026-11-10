import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { FuelSchedule } from '../components/plan/FuelSchedule.jsx';
import { FuelSummary } from '../components/plan/FuelSummary.jsx';
import { HourlySummary, RideBadges } from '../components/plan/HourlySummary.jsx';
import { SCORES } from '../components/rides/CheckInForm.jsx';
import { IntakeLogger } from '../components/rides/IntakeLogger.jsx';
import { Suggestions } from '../components/rides/Suggestions.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useSnackbar } from '../components/ui/Snackbar.jsx';
import { useCheckIn } from '../hooks/useCheckIns.js';
import { useFoods } from '../hooks/useFoods.js';
import { useDeleteRide, useRide, useUpdateRide } from '../hooks/useRides.js';
import { t } from '../i18n/index.js';
import { formatDate, formatDuration } from '../lib/format.js';
import { cToDisplay, formatDistance, formatElevation, tempUnit } from '../lib/units.js';

function CheckInCard({ rideId, checkIn, user }) {
  if (!checkIn) {
    return (
      <section className="card" aria-labelledby="checkin-title">
        <h2 id="checkin-title">{t('Check-in')}</h2>
        <p>{t('How did your stomach, energy and legs feel? It takes 30 seconds and makes your next plans smarter.')}</p>
        <Link to={`/rides/${rideId}/check-in`} className="btn btn--primary btn--block">
          {t('Check in')}
        </Link>
      </section>
    );
  }
  return (
    <>
      <section className="card" aria-labelledby="checkin-title">
        <h2 id="checkin-title">{t('Check-in')}</h2>
        <dl className="scores">
          {SCORES.map((s) => (
            <div key={s.key} className="scores__item">
              <dt>{t(s.label)}</dt>
              <dd>{checkIn[s.key]}/5</dd>
            </div>
          ))}
        </dl>
        {(checkIn.bonked || checkIn.cramped) && (
          <p>{[checkIn.bonked && t('Bonked'), checkIn.cramped && t('Cramped')].filter(Boolean).join(' · ')}</p>
        )}
        {checkIn.notes && <p className="muted">“{checkIn.notes}”</p>}
        <Link to={`/rides/${rideId}/check-in`} className="btn btn--secondary btn--block">
          {t('Edit check-in')}
        </Link>
      </section>
      <Suggestions checkIn={checkIn} user={user} />
    </>
  );
}

/** Archive (hide from Home, keep in progress) or delete for good. */
function RideActions({ ride }) {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const archive = useUpdateRide();
  const remove = useDeleteRide();

  function setArchived(archived) {
    archive.mutate(
      { id: ride.id, patch: { archived } },
      {
        onSuccess: () =>
          archived
            ? snackbar(t('Ride archived. It still counts in your progress.'), {
                action: { label: t('Undo'), onClick: () => setArchived(false) },
              })
            : snackbar(t('Ride restored.')),
      },
    );
  }

  function handleDelete() {
    remove.mutate(ride.id, {
      onSuccess: () => {
        snackbar(t('Ride deleted.'));
        navigate('/');
      },
    });
  }

  return (
    <section className="form__section danger-zone" aria-labelledby="ride-actions-title">
      <h2 id="ride-actions-title" className="visually-hidden">
        {t('Archive or delete this ride')}
      </h2>
      {ride.archived ? (
        <Button variant="secondary" block loading={archive.isPending} onClick={() => setArchived(false)}>
          {t('Restore to Home')}
        </Button>
      ) : (
        <Button variant="secondary" block loading={archive.isPending} onClick={() => setArchived(true)}>
          {t('Archive ride')}
        </Button>
      )}
      <p className="muted small">
        {t(
          'Archived rides are hidden from Home but still count in your progress. Deleting removes the ride and its check-in for good, including from your progress.',
        )}
      </p>
      <ConfirmButton block confirmLabel={t('Delete for good')} onConfirm={handleDelete} loading={remove.isPending}>
        {t('Delete ride')}
      </ConfirmButton>
      {(archive.error || remove.error) && <Notice tone="error">{(archive.error || remove.error).message}</Notice>}
    </section>
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
        <PageHeader title={t('Ride')} backTo="/" />
        <Notice tone="error">{ride.error.status === 404 ? t('That ride no longer exists.') : ride.error.message}</Notice>
      </div>
    );
  }

  const r = ride.data;
  const details = [formatDate(r.date), formatDuration(r.durationMin)];
  if (r.tempC !== undefined && r.tempC !== null) details.push(`${cToDisplay(r.tempC, user.units)}${tempUnit(user.units)}`);
  // Imported from a ride file: the distance and climbing it recorded
  if (r.imported?.distanceKm) details.push(formatDistance(r.imported.distanceKm, user.units));
  if (r.imported?.elevationGainM) details.push(`↑ ${formatElevation(r.imported.elevationGainM, user.units)}`);

  return (
    <div className="page">
      <PageHeader title={r.name || t('Ride plan')} backTo="/" />
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
            {t('Recalculate plan')}
          </Button>
          <p className="muted small">{t('Uses your current profile, food values and the latest fueling rules.')}</p>
        </div>
      )}

      <h2 className="section-title">{t('After the ride')}</h2>
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
      <RideActions ride={r} />
    </div>
  );
}
