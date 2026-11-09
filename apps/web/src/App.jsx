import { Navigate, Route, Routes } from 'react-router';
import { PublicOnly, RequireAuth } from './auth/RouteGuards.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { CheckInPage } from './pages/CheckInPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { EventFormPage } from './pages/EventFormPage.jsx';
import { EventsPage } from './pages/EventsPage.jsx';
import { FoodEditPage } from './pages/FoodEditPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { PrivacyPage } from './legal/PrivacyPage.jsx';
import { TermsPage } from './legal/TermsPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { VerifyEmailPage } from './pages/VerifyEmailPage.jsx';
import { FoodLibraryPage } from './pages/FoodLibraryPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { PlanRidePage } from './pages/PlanRidePage.jsx';
import { ProgressPage } from './pages/ProgressPage.jsx';
import { RideDetailPage } from './pages/RideDetailPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';

/** Route table (docs/ARCHITECTURE.md §4). Rides list, intake logging, check-ins and progress come next. */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        }
      />
      {/* Opened from emails: work whether or not the rider is logged in */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="foods" element={<FoodLibraryPage />} />
          <Route path="foods/new" element={<FoodEditPage />} />
          <Route path="foods/:id" element={<FoodEditPage />} />
          <Route path="plan" element={<PlanRidePage />} />
          <Route path="rides/:id" element={<RideDetailPage />} />
          <Route path="rides/:id/check-in" element={<CheckInPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/new" element={<EventFormPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="events/:id/edit" element={<EventFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
