import { useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { DeleteAccount } from '../components/profile/DeleteAccount.jsx';
import { ProfileForm } from '../components/profile/ProfileForm.jsx';
import { YourData } from '../components/profile/YourData.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Notice } from '../components/ui/Notice.jsx';
import { useUpdateProfile } from '../hooks/useProfile.js';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const update = useUpdateProfile();

  // Once the session clears, the route guard sends the rider to /login
  const handleLogout = () => logout();

  return (
    <div className="page">
      <PageHeader title="Profile" />
      {location.state?.welcome && !user.weightKg && (
        <Notice>Welcome! Add your weight so we can plan your rides. Everything else is optional.</Notice>
      )}
      <ProfileForm
        user={user}
        onSubmit={(patch) => update.mutate(patch)}
        submitting={update.isPending}
        serverError={update.error}
        saved={update.isSuccess}
      />
      <p className="muted small">
        Fueling targets are general sports-nutrition guidance, not medical advice.
      </p>
      <Button variant="secondary" block onClick={handleLogout}>
        Log out
      </Button>
      <YourData />
      <DeleteAccount />
    </div>
  );
}
