import { useOnline } from '../../lib/offline.js';
import { CloudOffIcon } from '../ui/icons.jsx';

/** Tells the rider they're seeing the copy saved on this phone, and that saving needs a connection. */
export function OfflineBar() {
  const online = useOnline();
  // The live region is always rendered, so going offline is announced
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p className="offline-bar">
          <CloudOffIcon size={20} />
          <span>You&apos;re offline. Showing what&apos;s saved on this phone; changes can&apos;t be saved until you&apos;re back online.</span>
        </p>
      )}
    </div>
  );
}
