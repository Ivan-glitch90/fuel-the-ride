import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BikeIcon, FlagIcon, FoodIcon, HomeIcon, UserIcon } from '../ui/icons.jsx';
import { ConfirmEmailBanner } from './ConfirmEmailBanner.jsx';
import { OfflineBar } from './OfflineBar.jsx';

const NAV = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/plan', label: 'Plan', Icon: BikeIcon },
  { to: '/events', label: 'Events', Icon: FlagIcon },
  { to: '/foods', label: 'Foods', Icon: FoodIcon },
  { to: '/settings', label: 'Profile', Icon: UserIcon },
];

/** Logged-in layout: top app bar, page content, and an M3 navigation bar within thumb reach. */
export function AppShell() {
  // A new page starts at the top (e.g. the saved ride after scrolling down the plan form)
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">Fuel the Ride</span>
      </header>
      <main className="shell__main">
        <OfflineBar />
        <ConfirmEmailBanner />
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__link">
            {({ isActive }) => (
              <>
                <span className="bottom-nav__indicator">
                  <Icon filled={isActive} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
