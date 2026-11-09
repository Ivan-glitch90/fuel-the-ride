import { NavLink, Outlet } from 'react-router';
import { BikeIcon, FlagIcon, FoodIcon, HomeIcon, UserIcon } from '../ui/icons.jsx';
import { ConfirmEmailBanner } from './ConfirmEmailBanner.jsx';

const NAV = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/plan', label: 'Plan', Icon: BikeIcon },
  { to: '/events', label: 'Events', Icon: FlagIcon },
  { to: '/foods', label: 'Foods', Icon: FoodIcon },
  { to: '/settings', label: 'Profile', Icon: UserIcon },
];

/** Logged-in layout: header, page content, and a bottom nav within thumb reach. */
export function AppShell() {
  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">Fuel the Ride</span>
      </header>
      <main className="shell__main">
        <ConfirmEmailBanner />
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__link">
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
