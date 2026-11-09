import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CloseIcon } from './icons.jsx';

const SnackbarContext = createContext(() => {});

/**
 * Material 3 snackbar: a short confirmation ("Ride plan saved.") at the bottom of the screen.
 * It sits above the routes, so a page can show one and then navigate away.
 * For confirmations only: errors and anything the rider must act on stay inline, next to where they happened.
 */
export const useSnackbar = () => useContext(SnackbarContext);

const DURATION_MS = 5000;

export function SnackbarProvider({ children }) {
  const [current, setCurrent] = useState(null); // { id, message }
  const [paused, setPaused] = useState(false);

  const show = useCallback((message) => setCurrent({ id: crypto.randomUUID(), message }), []);
  const dismiss = () => setCurrent(null);

  // Auto-dismiss, but not while the pointer or keyboard focus is on it (time to read; WCAG 2.2.1)
  useEffect(() => {
    if (!current || paused) return undefined;
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
            <button type="button" className="icon-btn snackbar__close" aria-label="Dismiss" onClick={dismiss}>
              <CloseIcon size={20} />
            </button>
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}
