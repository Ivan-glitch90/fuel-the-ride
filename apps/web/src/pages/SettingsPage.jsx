import { useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Appearance } from '../components/profile/Appearance.jsx';
import { DeleteAccount } from '../components/profile/DeleteAccount.jsx';
import { LanguagePicker } from '../components/profile/LanguagePicker.jsx';
import { ProfileForm } from '../components/profile/ProfileForm.jsx';
import { YourData } from '../components/profile/YourData.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useSnackbar } from '../components/ui/Snackbar.jsx';
import { useUpdateProfile } from '../hooks/useProfile.js';
import { t } from '../i18n/index.js';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const update = useUpdateProfile();
  const snackbar = useSnackbar();

  // Once the session clears, the route guard sends the rider to /login
  const handleLogout = () => logout();

  return (
    <div className="page">
      <PageHeader title={t('Profile')} />
      {location.state?.welcome && !user.weightKg && (
        <Notice>{t('Welcome! Add your weight so we can plan your rides. Everything else is optional.')}</Notice>
      )}
      <ProfileForm
        user={user}
        onSubmit={(patch) => update.mutate(patch, { onSuccess: () => snackbar(t('Profile saved.')) })}
        submitting={update.isPending}
        serverError={update.error}
      />
      <p className="muted small">{t('Fueling targets are general sports-nutrition guidance, not medical advice.')}</p>
      <Button variant="secondary" block onClick={handleLogout}>
        {t('Log out')}
      </Button>
      <LanguagePicker />
      <Appearance />
      <YourData />
      <DeleteAccount />
    </div>
  );
}
