import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { CheckInForm } from '../components/rides/CheckInForm.jsx';
import { Suggestions } from '../components/rides/Suggestions.jsx';
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useCheckIn, useSaveCheckIn } from '../hooks/useCheckIns.js';
import { useRide } from '../hooks/useRides.js';

/** /rides/:id/check-in: answer three questions, then see (and accept) the suggestions. */
export function CheckInPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const ride = useRide(id);
  const checkIn = useCheckIn(id);
  const save = useSaveCheckIn(id);
  const [submitted, setSubmitted] = useState(false);

  if (ride.isPending || checkIn.isPending) return <LoadingScreen />;
  if (ride.isError) return <Notice tone="error">{ride.error.message}</Notice>;

  return (
    <div className="page">
      <PageHeader title="How did it go?" backTo={`/rides/${id}`} />
      <p className="muted">{ride.data.name || 'Ride'}</p>
      {!ride.data.actual && (
        <Notice>
          Tip: <Link to={`/rides/${id}`}>log what you ate</Link> first, so the suggestions know how much you actually
          ate.
        </Notice>
      )}

      {submitted && checkIn.data ? (
        <>
          <Notice tone="success">Check-in saved.</Notice>
          <Suggestions checkIn={checkIn.data} user={user} />
          <Link to={`/rides/${id}`} className="btn btn--secondary btn--block">
            Back to the ride
          </Link>
        </>
      ) : (
        <CheckInForm
          checkIn={checkIn.data}
          submitting={save.isPending}
          error={save.error}
          onSubmit={(answers) =>
            save.mutate({ id: checkIn.data?.id, answers }, { onSuccess: () => setSubmitted(true) })
          }
        />
      )}
    </div>
  );
}
