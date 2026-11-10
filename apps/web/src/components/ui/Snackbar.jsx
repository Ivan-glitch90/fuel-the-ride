import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CloseIcon } from './icons.jsx';

const SnackbarContext = createContext(() => {});

/**
 * Material 3 snackbar: a short confirmation ("Ride plan saved.") at the bottom of the screen.
 * It sits above the routes, so a page can show one and then navigate away.
 * For confirmations only: errors and anything the rider must act on stay inline, next to where they happened.
 *
 * snackbar(message) or snackbar(message, { action: { label, onClick }, persistent: true })
 * - action: one text button (M3 allows one), e.g. "Reload"
 * - persistent: stays until the action or ✕ is used (for messages the rider shouldn't miss)
 */
export const useSnackbar = () => useContext(SnackbarContext);

const DURATION_MS = 5000;

export function SnackbarProvider({ children }) {
  const [current, setCurrent] = useState(null); // { id, message, action?, persistent? }
  const [paused, setPaused] = useState(false);

  const show = useCallback(
    (message, { action, persistent = false } = {}) =>
      setCurrent({ id: crypto.randomUUID(), message, action, persistent }),
    [],
  );
  const dismiss = () => setCurrent(null);

  // Auto-dismiss, but not while the pointer or keyboard focus is on it (time to read; WCAG 2.2.1)
  useEffect(() => {
    if (!current || current.persistent || paused) return undefined;
    const timer = setTimeout(() => setCurrent(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, paused]);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {/* The live region is always present, so screen readers announce each new message */}
      <div className="snackbar-region" role="status" aria-live="polite">
        {current && (
          <div
            key={current.id}
            className="snackbar"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <span className="snackbar__text">{current.message}</span>
            {current.action && (
              <button
                type="button"
                className="snackbar__action"
                onClick={() => {
                  dismiss();
                  current.action.onClick();
                }}
              >
                {current.action.label}
              </button>
            )}
            <button type="button" className="icon-btn snackbar__close" aria-label="Dismiss" onClick={dismiss}>
              <CloseIcon size={20} />
            </button>
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}
