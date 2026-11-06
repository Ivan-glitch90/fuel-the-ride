import { Navigate, Route, Routes } from 'react-router';
import { PublicOnly, RequireAuth } from './auth/RouteGuards.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { FoodEditPage } from './pages/FoodEditPage.jsx';
import { FoodLibraryPage } from './pages/FoodLibraryPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';

/** Route table (docs/ARCHITECTURE.md §4). Rides, check-ins and progress pages come next. */
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
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="foods" element={<FoodLibraryPage />} />
          <Route path="foods/new" element={<FoodEditPage />} />
          <Route path="foods/:id" element={<FoodEditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
