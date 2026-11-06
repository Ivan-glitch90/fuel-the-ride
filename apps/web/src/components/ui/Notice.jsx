/** Inline message. tone: info | success | error */
export function Notice({ tone = 'info', children }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
