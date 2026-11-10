import { useUpdateProfile } from '../../hooks/useProfile.js';
import { t, tCode, tx } from '../../i18n/index.js';
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
  const reason = tCode(carbRate.reasonCode, carbRate.reason, carbRate.reasonParams);

  return (
    <section className="card suggestions" aria-labelledby="suggestions-title">
      <h2 id="suggestions-title">{t('Suggestions')}</h2>

      {carbRate.suggestedGph !== null ? (
        <div className="suggestion">
          <p>{reason}</p>
          {rateAccepted ? (
            <Notice tone="success">
              {t('Your trained carb rate is now {rate} g/hr.', { rate: carbRate.suggestedGph })}
            </Notice>
          ) : (
            <Button
              block
              loading={update.isPending && update.variables?.trainedCarbRateGph !== undefined}
              onClick={() => update.mutate({ trainedCarbRateGph: carbRate.suggestedGph })}
            >
              {t('Set my trained rate to {rate} g/hr', { rate: carbRate.suggestedGph })}
            </Button>
          )}
        </div>
      ) : (
        <p className="muted">{t('Carb rate: no change. {reason}', { reason })}</p>
      )}

      {flags.map((flag) => (
        <Notice key={flag.code} tone="warning">
          {tCode(flag.code, flag.message, flag.params)}
        </Notice>
      ))}

      {sweat !== null && (
        <div className="suggestion">
          <p>
            {tx(
              'Your sweat rate on this ride: <b>{rate}/hr</b>.',
              { b: (text) => <strong>{text}</strong> },
              { rate: formatFluid(sweat, user.units) },
            )}
          </p>
          {sweatAccepted ? (
            <Notice tone="success">{t('Saved. Future plans use your measured sweat rate.')}</Notice>
          ) : (
            <Button
              variant="secondary"
              block
              loading={update.isPending && update.variables?.sweatRateMlPerHr !== undefined}
              onClick={() => update.mutate({ sweatRateMlPerHr: sweat })}
            >
              {t('Use it for future plans')}
            </Button>
          )}
        </div>
      )}

      {carbRate.suggestedGph === null && flags.length === 0 && sweat === null && (
        <p>{t('Nothing to change. Keep fueling like this.')}</p>
      )}
      {update.error && <Notice tone="error">{update.error.message}</Notice>}
    </section>
  );
}
