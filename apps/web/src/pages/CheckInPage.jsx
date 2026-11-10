import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { CheckInForm } from '../components/rides/CheckInForm.jsx';
import { Suggestions } from '../components/rides/Suggestions.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useSnackbar } from '../components/ui/Snackbar.jsx';
import { useCheckIn, useSaveCheckIn } from '../hooks/useCheckIns.js';
import { useRide } from '../hooks/useRides.js';
import { t, tx } from '../i18n/index.js';

/** /rides/:id/check-in: answer three questions, then see (and accept) the suggestions. */
export function CheckInPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const ride = useRide(id);
  const checkIn = useCheckIn(id);
  const save = useSaveCheckIn(id);
  const [submitted, setSubmitted] = useState(false);
  const snackbar = useSnackbar();

  if (ride.isPending || checkIn.isPending) return <LoadingScreen />;
  if (ride.isError) return <Notice tone="error">{ride.error.message}</Notice>;

  return (
    <div className="page">
      <PageHeader title={t('How did it go?')} backTo={`/rides/${id}`} />
      <p className="muted">{ride.data.name || t('Ride')}</p>
      {!ride.data.actual && (
        <Notice>
          {tx('Tip: <link>log what you ate</link> first, so the suggestions know how much you actually ate.', {
            link: (text) => <Link to={`/rides/${id}`}>{text}</Link>,
          })}
        </Notice>
      )}

      {submitted && checkIn.data ? (
        <>
          <Suggestions checkIn={checkIn.data} user={user} />
          <Link to={`/rides/${id}`} className="btn btn--secondary btn--block">
            {t('Back to the ride')}
          </Link>
        </>
      ) : (
        <CheckInForm
          checkIn={checkIn.data}
          submitting={save.isPending}
          error={save.error}
          onSubmit={(answers) =>
            save.mutate(
              { id: checkIn.data?.id, answers },
              {
                onSuccess: () => {
                  snackbar(t('Check-in saved.'));
                  setSubmitted(true);
                },
              },
            )
          }
        />
      )}
    </div>
  );
}
