import { t } from '../../i18n/index.js';

/** Large, thumb-friendly button. variant: primary | secondary | danger | ghost */
export function Button({
  variant = 'primary',
  loading = false,
  block = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const classes = ['btn', `btn--${variant}`, block && 'btn--block', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={loading || disabled} aria-busy={loading || undefined} {...props}>
      {loading ? t('Saving…') : children}
    </button>
  );
}
