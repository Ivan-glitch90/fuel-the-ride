import { useState } from 'react';
import { deleteAccount } from '../../api/users.js';
import { fieldErrors } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { t, tx } from '../../i18n/index.js';
import { Button } from '../ui/Button.jsx';
import { Field, PasswordField } from '../ui/Field.jsx';
import { Notice } from '../ui/Notice.jsx';

/** Danger zone: deletes the account and all its data. Password (if any) + typing DELETE. */
export function DeleteAccount() {
  const { user, forgetSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (!open) {
    return (
      <div className="danger-zone">
        <Button variant="danger" block onClick={() => setOpen(true)}>
          {t('Delete my account')}
        </Button>
      </div>
    );
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount({ confirm: form.confirm, ...(user.hasPassword && { password: form.password }) });
      forgetSession(); // the route guard then shows the login page
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  const errors = fieldErrors(error);
  return (
    <form className="danger-zone form" onSubmit={handleDelete} noValidate aria-labelledby="delete-title">
      <h2 id="delete-title">{t('Delete my account')}</h2>
      <p>
        {tx(
          "This permanently deletes your account and <strong>all your data</strong>: profile, foods, rides, check-ins and events. It can't be undone.",
          { strong: (text) => <strong>{text}</strong> },
        )}
      </p>
      {error && error.code === 'INVALID_CREDENTIALS' && <Notice tone="error">{error.message}</Notice>}
      {error && !['INVALID_CREDENTIALS', 'VALIDATION_FAILED'].includes(error.code) && (
        <Notice tone="error">{error.message}</Notice>
      )}
      {user.hasPassword && (
        <PasswordField
          label={t('Your password')}
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      )}
      <Field
        label={t('Type DELETE to confirm')}
        autoComplete="off"
        autoCapitalize="characters"
        value={form.confirm}
        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        error={errors.confirm}
      />
      <Button type="submit" variant="danger" block loading={deleting} disabled={form.confirm !== 'DELETE'}>
        {t('Delete everything')}
      </Button>
      <Button variant="ghost" block onClick={() => setOpen(false)}>
        {t('Cancel')}
      </Button>
    </form>
  );
}
