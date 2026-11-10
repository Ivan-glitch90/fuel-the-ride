import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { resetPassword } from '../api/auth.js';
import { fieldErrors } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { PasswordField } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { t } from '../i18n/index.js';

/** /reset-password?token=…: opened from the reset email. Resetting logs out every device. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { forgetSession } = useAuth();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.password.length < 8) found.password = t('At least 8 characters');
    if (form.confirm !== form.password) found.confirm = t("Passwords don't match");
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, form.password);
      forgetSession(); // the server ended every session, this device included
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <h1 className="auth-page__brand">Fuel the Ride</h1>
        <Notice tone="error">{t('This link is incomplete. Open it again from the email.')}</Notice>
        <p className="auth-page__switch">
          <Link to="/forgot-password">{t('Ask for a new link')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__brand">Fuel the Ride</h1>
      <div className="card">
        {done ? (
          <div className="form">
            <h2>{t('Password changed')}</h2>
            <p>{t("You've been logged out on every device. Log in with your new password.")}</p>
            <Link to="/login" className="btn btn--primary btn--block">
              {t('Log in')}
            </Link>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit} noValidate>
            <h2>{t('Choose a new password')}</h2>
            {error && (
              <Notice tone="error">
                {error.message}{' '}
                {error.code === 'INVALID_TOKEN' && <Link to="/forgot-password">{t('Ask for a new link')}</Link>}
              </Notice>
            )}
            <PasswordField
              label={t('New password')}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password ?? fieldErrors(error).password}
              hint={t('At least 8 characters')}
            />
            <PasswordField
              label={t('Repeat new password')}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              error={errors.confirm}
            />
            <Button type="submit" block loading={submitting}>
              {t('Change password')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
