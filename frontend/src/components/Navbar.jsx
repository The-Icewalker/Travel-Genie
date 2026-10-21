import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useState } from 'react';

const PlaneIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 16l20-8-20-8 4 8-4 8zm4-8h16" />
  </svg>
);

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/trips',     label: 'Trips' },
    { to: '/bookings',  label: 'Bookings' },
    { to: '/map',       label: 'Map' },
    { to: '/weather',   label: 'Weather' },
    { to: '/budget',    label: 'Budget' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];


  return (
    <header className="sticky top-0 z-30 backdrop-blur" style={{ background: 'rgba(246,241,233,.88)', borderBottom: '1px solid var(--line)' }}>
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl flex items-center justify-center rotate-[-8deg]"
            style={{ background: 'var(--ink)', color: 'var(--sun)' }}>
            <PlaneIcon />
          </span>
          <span className="tg-serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Travel<span style={{ color: 'var(--coral)' }}>Genie</span>
          </span>
        </Link>

        {/* Desktop nav pill */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full"
          style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-semibold transition ${isActive
                  ? 'text-[var(--paper)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'}`
              }
              style={({ isActive }) => isActive ? { background: 'var(--ink)' } : {}}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User chip + sign-out */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: 'var(--sun)', color: 'var(--ink)' }}>
              {(user?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{user?.full_name || user?.email}</div>
              {isAdmin && <div className="text-xs font-semibold" style={{ color: 'var(--coral)' }}>Admin</div>}
            </div>
          </div>
          <button onClick={handleLogout} className="tg-ghost text-sm">Sign out</button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-lg" style={{ color: 'var(--ink-2)' }}
          onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-6 pb-4 space-y-1" style={{ borderTop: '1px solid var(--line)' }}>
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-xl text-sm font-semibold transition ${isActive ? '' : ''}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--ink)', color: 'var(--paper)' }
                : { color: 'var(--ink-2)' }}>
              {label}
            </NavLink>
          ))}
          <div className="pt-3 mt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{user?.full_name || user?.email}</p>
            <button onClick={handleLogout} className="tg-ghost text-sm">Sign out</button>
          </div>
        </div>
      )}
    </header>
  );
}
