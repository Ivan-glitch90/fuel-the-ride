import { useUpdateProfile } from '../../hooks/useProfile.js';
import { formatFluid } from '../../lib/units.js';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';

/**
 * What the check-in suggests (FUELING_RULES.md §9). Nothing changes until the rider accepts:
 * accepting sets the trained carb rate or sweat rate in the profile.
 */
export function Suggestions({ checkIn, user }) {
  const update = useUpdateProfile();
  const { carbRate, flags, measuredSweatRateMlPerHr: sweat } = checkIn.suggestions;
  const rateAccepted = carbRate.suggestedGph !== null && user.trainedCarbRateGph === carbRate.suggestedGph;
  const sweatAccepted = sweat !== null && user.sweatRateMlPerHr === sweat;

  return (
    <section className="card suggestions" aria-labelledby="suggestions-title">
      <h2 id="suggestions-title">Suggestions</h2>

      {carbRate.suggestedGph !== null ? (
        <div className="suggestion">
          <p>{carbRate.reason}</p>
          {rateAccepted ? (
            <Notice tone="success">Your trained carb rate is now {carbRate.suggestedGph} g/hr.</Notice>
          ) : (
            <Button
              block
              loading={update.isPending && update.variables?.trainedCarbRateGph !== undefined}
              onClick={() => update.mutate({ trainedCarbRateGph: carbRate.suggestedGph })}
            >
              Set my trained rate to {carbRate.suggestedGph} g/hr
            </Button>
          )}
        </div>
      ) : (
        <p className="muted">Carb rate: no change. {carbRate.reason}</p>
      )}

      {flags.map((flag) => (
        <Notice key={flag.code} tone="warning">
          {flag.message}
        </Notice>
      ))}

      {sweat !== null && (
        <div className="suggestion">
          <p>
            Your sweat rate on this ride: <strong>{formatFluid(sweat, user.units)}/hr</strong>.
          </p>
          {sweatAccepted ? (
            <Notice tone="success">Saved. Future plans use your measured sweat rate.</Notice>
          ) : (
            <Button
              variant="secondary"
              block
              loading={update.isPending && update.variables?.sweatRateMlPerHr !== undefined}
              onClick={() => update.mutate({ sweatRateMlPerHr: sweat })}
            >
              Use it for future plans
            </Button>
          )}
        </div>
      )}

      {carbRate.suggestedGph === null && flags.length === 0 && sweat === null && (
        <p>Nothing to change. Keep fueling like this.</p>
      )}
      {update.error && <Notice tone="error">{update.error.message}</Notice>}
    </section>
  );
}
