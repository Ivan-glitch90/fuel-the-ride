import { useState } from 'react';
import { t } from '../../i18n/index.js';
import { Button } from './Button.jsx';

/** Two-tap destructive action: the first tap asks, the second does it. No browser dialogs. */
export function ConfirmButton({ children, confirmLabel, onConfirm, loading, variant = 'danger', ...props }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant={variant} onClick={() => setAsking(true)} {...props}>
        {children}
      </Button>
    );
  }
  return (
    <div className="confirm">
      <Button variant={variant} loading={loading} onClick={onConfirm} {...props}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        {t('Cancel')}
      </Button>
    </div>
  );
}
