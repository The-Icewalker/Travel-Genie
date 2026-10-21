import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function FormField({ id, name, label, type = 'text', placeholder, autoComplete, value, onChange, error }) {
  return (
    <div>
      <label htmlFor={id || name} className="tg-label block mb-1">
        {label}
      </label>
      <input
        id={id || name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className={`tg-input ${error ? '!border-[var(--coral)]' : ''}`}
        placeholder={placeholder}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--coral)] font-medium">{error}</p>
      )}
    </div>
  );
}

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required.';
    if (!form.email.trim()) errs.email = 'Email address is required.';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirm_password)
      errs.confirm_password = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await register(form.full_name, form.email, form.password, form.confirm_password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        for (const [key, val] of Object.entries(data)) {
          const fieldKey = (key === 'password2' || key === 'password_confirm') ? 'confirm_password' : key;
          mapped[fieldKey] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setFieldErrors(mapped);
        if (data.detail) {
          setError(data.detail);
        } else if (data.non_field_errors) {
          setError(Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors);
        } else {
          setError('Please review the highlighted fields below.');
        }
      } else {
        setError(err.message || 'Registration failed. Please check your information.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--sand)] flex flex-col justify-center items-center p-4 relative overflow-hidden tg-grain">
      {/* Decorative background glows */}
      <div
        className="absolute top-1/4 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'var(--coral-soft)' }}
      />
      <div
        className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'var(--sea-soft)' }}
      />

      <div className="w-full max-w-md relative z-10 tg-rise">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-sm border border-[var(--line)]"
            style={{ background: 'var(--paper)' }}
          >
            <span className="text-2xl tg-float">🌍</span>
          </div>
          <div className="tg-label tracking-[0.2em]" style={{ color: 'var(--sea)' }}>
            Passport Office
          </div>
          <h1 className="tg-serif text-4xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
            Join TravelGenie
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--mute)' }}>
            Create your traveler profile and begin curating custom journeys
          </p>
        </div>

        {/* Boarding Pass Style Card */}
        <div className="tg-card overflow-hidden shadow-2xl">
          <div
            className="px-6 py-3 border-b flex items-center justify-between text-xs font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
          >
            <span className="tracking-wider uppercase">New Traveler Application</span>
            <span className="text-[var(--sun)] font-mono">TG // PASS</span>
          </div>

          <div className="p-7">
            {error && (
              <div
                className="mb-5 p-3 rounded-xl border text-sm font-medium flex items-center gap-2"
                style={{ background: 'var(--coral-soft)', borderColor: 'var(--coral)', color: 'var(--coral)' }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                name="full_name"
                label="Full Name"
                value={form.full_name}
                onChange={handleChange}
                error={fieldErrors.full_name}
                placeholder="Eleanor Vance"
                autoComplete="name"
              />
              <FormField
                name="email"
                label="Email Address"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={fieldErrors.email}
                placeholder="eleanor@example.com"
                autoComplete="email"
              />
              <FormField
                name="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={fieldErrors.password}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <FormField
                name="confirm_password"
                label="Confirm Password"
                type="password"
                value={form.confirm_password}
                onChange={handleChange}
                error={fieldErrors.confirm_password}
                placeholder="Repeat password"
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="tg-btn w-full justify-center text-center mt-3 py-3"
              >
                {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                <span>{loading ? 'Creating Passport…' : 'Issue Passport & Enter →'}</span>
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[var(--mute)]">
              Already have a traveler account?{' '}
              <Link to="/login" className="font-semibold text-[var(--coral)] hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-[var(--mute)]">
          TravelGenie AI · Bespoke Editorial Travel Planner
        </div>
      </div>
    </div>
  );
}
