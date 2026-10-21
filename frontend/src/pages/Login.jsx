import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleQuickFill = (email, password) => {
    setForm({ email, password });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : data?.non_field_errors) ||
        (Array.isArray(data?.email) ? data.email[0] : data?.email) ||
        (Array.isArray(data?.password) ? data.password[0] : data?.password) ||
        err.message ||
        'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--sand)] flex flex-col justify-center items-center p-4 relative overflow-hidden tg-grain">
      {/* Decorative background glows */}
      <div
        className="absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'var(--coral-soft)' }}
      />
      <div
        className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'var(--sea-soft)' }}
      />

      <div className="w-full max-w-md relative z-10 tg-rise">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-sm border border-[var(--line)]"
               style={{ background: 'var(--paper)' }}>
            <span className="text-2xl tg-float">✈️</span>
          </div>
          <div className="tg-label tracking-[0.2em]" style={{ color: 'var(--coral)' }}>
            Boarding Gate
          </div>
          <h1 className="tg-serif text-4xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
            TravelGenie
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--mute)' }}>
            Sign in to access your curated journeys & itineraries
          </p>
        </div>

        {/* Boarding Pass Style Card */}
        <div className="tg-card overflow-hidden shadow-2xl">
          {/* Header strip */}
          <div className="px-6 py-3 border-b flex items-center justify-between text-xs font-semibold"
               style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
            <span className="tracking-wider uppercase">Passenger Check-In</span>
            <span className="text-[var(--sun)] font-mono">TG // 2026</span>
          </div>

          <div className="p-7">
            {error && (
              <div className="mb-5 p-3 rounded-xl border text-sm font-medium flex items-center gap-2"
                   style={{ background: 'var(--coral-soft)', borderColor: 'var(--coral)', color: 'var(--coral)' }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="tg-label block mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="tg-input"
                  placeholder="traveler@travelgenie.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="tg-label">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className="tg-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="tg-btn w-full justify-center text-center mt-3 py-3"
              >
                {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                <span>{loading ? 'Authenticating…' : 'Board Journey →'}</span>
              </button>
            </form>

            {/* Quick-fill credentials for demo / testing */}
            <div className="mt-6 pt-5 border-t border-dashed" style={{ borderColor: 'var(--line)' }}>
              <div className="tg-label text-center mb-3 text-[10px]">Quick Demo Sign-In</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('traveler@travelgenie.com', 'Travel@123')}
                  className="tg-ghost text-xs py-2 px-3 text-center flex flex-col items-center justify-center hover:border-[var(--sea)]"
                >
                  <span className="font-bold text-[var(--sea)]">Traveler</span>
                  <span className="text-[10px] text-[var(--mute)]">traveler@travelgenie.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@travelgenie.com', 'Admin@123')}
                  className="tg-ghost text-xs py-2 px-3 text-center flex flex-col items-center justify-center hover:border-[var(--coral)]"
                >
                  <span className="font-bold text-[var(--coral)]">Admin</span>
                  <span className="text-[10px] text-[var(--mute)]">admin@travelgenie.com</span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-[var(--mute)]">
              Don&apos;t have an account yet?{' '}
              <Link to="/register" className="font-semibold text-[var(--coral)] hover:underline">
                Register as a traveler
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-[var(--mute)]">
          TravelGenie AI · Bespoke Editorial Travel Planner
        </div>
      </div>
    </div>
  );
}
