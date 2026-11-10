import { useState } from 'react';
import { exportMyData } from '../../api/users.js';
import { t } from '../../i18n/index.js';
import { LegalLinks } from '../../legal/LegalLinks.jsx';
import { Button } from '../ui/Button.jsx';
import { Notice } from '../ui/Notice.jsx';
import { useSnackbar } from '../ui/Snackbar.jsx';

/** Profile → "Your data": a copy of everything stored (GDPR right of access), plus the policies. */
export function YourData() {
  const [state, setState] = useState('idle'); // idle | working | error
  const snackbar = useSnackbar();

  async function download() {
    setState('working');
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fuel-the-ride-data-${data.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState('idle');
      snackbar(t('Downloaded. Check your Downloads folder.'));
    } catch {
      setState('error');
    }
  }

  return (
    <section className="form__section your-data" aria-labelledby="your-data-title">
      <h2 id="your-data-title">{t('Your data')}</h2>
      <p className="muted small">
        {t('Download a copy of everything Fuel the Ride stores about you: profile, foods, rides, check-ins and events.')}
      </p>
      <Button variant="secondary" block onClick={download} loading={state === 'working'}>
        {t('Download my data')}
      </Button>
      {state === 'error' && <Notice tone="error">{t("Couldn't prepare your data. Please try again.")}</Notice>}
      <LegalLinks />
    </section>
  );
}
