import { useEffect } from 'react';
import { t } from '../../i18n/index.js';
import { applyUpdate, onUpdateReady } from '../../lib/pwa.js';
import { useSnackbar } from '../ui/Snackbar.jsx';

/** When a new version has downloaded, offer to switch. It never reloads on its own (could be mid-ride). */
export function UpdateNotifier() {
  const snackbar = useSnackbar();
  useEffect(
    () =>
      onUpdateReady(() =>
        snackbar(t('A new version of Fuel the Ride is ready.'), {
          action: { label: t('Reload'), onClick: applyUpdate },
          persistent: true,
        }),
      ),
    [snackbar],
  );
  return null;
}
