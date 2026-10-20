import { useEffect, useState } from 'react';
import {
  getUsers,
  deleteUser,
  updateUser,
  getTripsPerUser,
  getAvgHotelPricePerCity,
  getSiteStats,
} from '../api/admin.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmt   = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function UserRow({ user, onDelete, onToggleRole, onToggleStatus }) {
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === 'admin' || user.role_name === 'admin';

  const handleDelete = async () => {
    if (!window.confirm(`Delete traveler account "${user.email}"? This cannot be undone.`)) return;
    setBusy(true);
    await onDelete(user.id);
    setBusy(false);
  };

  const handleToggleRole = async () => {
    setBusy(true);
    await onToggleRole(user.id, isAdmin ? 'traveler' : 'admin');
    setBusy(false);
  };

  const handleToggleStatus = async () => {
    setBusy(true);
    await onToggleStatus(user.id, user.is_active !== false);
    setBusy(false);
  };

  return (
    <tr style={{ borderTop: '1px solid var(--line)' }} className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs"
            style={{
              background: isAdmin ? 'var(--coral-soft)' : 'var(--sun-soft)',
              color: isAdmin ? 'var(--coral)' : 'var(--ink)',
            }}
          >
            {(user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
          </span>
          <div>
            <div className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <span>{user.full_name || 'Anonymous Traveler'}</span>
              <span className="text-[10px] font-mono text-[var(--mute)] bg-slate-100 px-1.5 py-0.5 rounded">
                #{user.id}
              </span>
            </div>
            <div className="text-xs text-[var(--mute)]">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-block"
          style={
            isAdmin
              ? { background: 'var(--coral-soft)', color: 'var(--coral)' }
              : { background: 'var(--line)', color: 'var(--ink-2)' }
          }
        >
          {isAdmin ? 'Admin' : 'Traveler'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm" style={{ color: 'var(--ink-2)' }}>
        {fmt(user.date_joined || user.created_at)}
      </td>
      <td className="px-6 py-4">
        <button
          onClick={handleToggleStatus}
          disabled={busy}
          title="Click to toggle status"
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full cursor-pointer transition hover:opacity-80"
          style={
            user.is_active === false
              ? { background: 'var(--coral-soft)', color: 'var(--coral)' }
              : { background: 'var(--moss-soft)', color: 'var(--moss)' }
          }
        >
          {user.is_active === false ? 'Inactive' : 'Active'}
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleToggleRole}
            disabled={busy}
            className="tg-ghost text-xs disabled:opacity-50 font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
          >
            {isAdmin ? 'Revoke Admin' : 'Make Admin'}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg font-bold border transition disabled:opacity-50 hover:bg-red-50"
            style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }}
          >
            {busy ? '…' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Admin() {
  const [tab,           setTab]           = useState('Users');
  const [users,         setUsers]         = useState([]);
  const [tripsPerUser,  setTripsPerUser]  = useState([]);
  const [avgHotelPrice, setAvgHotelPrice] = useState([]);
  const [siteStats,     setSiteStats]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [search,        setSearch]        = useState('');

  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [usersRes, tripsRes, hotelRes, statsRes] = await Promise.allSettled([
        getUsers(), getTripsPerUser(), getAvgHotelPricePerCity(), getSiteStats(),
      ]);
      if (usersRes.status  === 'fulfilled') { const d = usersRes.value.data;  setUsers(d?.results ?? d ?? []); }
      if (tripsRes.status  === 'fulfilled') { const d = tripsRes.value.data;  setTripsPerUser(d?.results ?? d ?? []); }
      if (hotelRes.status  === 'fulfilled') { const d = hotelRes.value.data;  setAvgHotelPrice(d?.results ?? d ?? []); }
      if (statsRes.status  === 'fulfilled') setSiteStats(statsRes.value.data);
    } catch { setError('Failed to load admin data.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const handleDelete = async (id) => {
    try { await deleteUser(id); setUsers((p) => p.filter((u) => u.id !== id)); }
    catch { alert('Failed to delete user.'); }
  };

  const handleToggleRole = async (id, newRole) => {
    try { await updateUser(id, { role: newRole }); setUsers((p) => p.map((u) => u.id === id ? { ...u, role: newRole, role_name: newRole } : u)); }
    catch { alert('Failed to update role.'); }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await updateUser(id, { is_active: newStatus });
      setUsers((p) => p.map((u) => u.id === id ? { ...u, is_active: newStatus } : u));
    } catch {
      alert('Failed to update user status.');
    }
  };

  const filteredUsers = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const maxTrips = Math.max(...tripsPerUser.map((r) => r.trip_count ?? 0), 1);
  const maxHotel = Math.max(...avgHotelPrice.map((r) => parseFloat(r.avg_price ?? 0)), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 tg-rise">
        <div>
          <div className="tg-label mb-3" style={{ color: 'var(--coral)' }}>Control tower</div>
          <h1 className="tg-serif text-5xl md:text-6xl font-bold leading-[0.95]">Admin Panel</h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--ink-2)' }}>Manage travellers and watch the skies.</p>
        </div>
      </div>

      {/* Site stats */}
      {siteStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { label: 'Users',    value: siteStats.total_users    ?? '—', icon: '👥', c: 'var(--sea)',   bg: 'var(--sea-soft)' },
            { label: 'Trips',    value: siteStats.total_trips    ?? '—', icon: '🗺️', c: 'var(--coral)', bg: 'var(--coral-soft)' },
            { label: 'Bookings', value: siteStats.total_bookings ?? '—', icon: '🎫', c: 'var(--sun)',   bg: 'var(--sun-soft)' },
            { label: 'Revenue',  value: siteStats.total_revenue ? money(siteStats.total_revenue) : '—', icon: '💰', c: 'var(--moss)', bg: 'var(--moss-soft)' },
          ].map(({ label, value, icon, c, bg }) => (
            <div key={label} className="tg-card p-6 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15" style={{ background: c }} />
              <span className="text-2xl">{icon}</span>
              <div className="tg-label mt-4">{label}</div>
              <div className="tg-serif text-4xl font-bold mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="inline-flex p-1 rounded-full" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
        {['Users', 'Analytics'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-full text-sm font-bold transition"
            style={tab === t
              ? { background: 'var(--ink)', color: 'var(--paper)' }
              : { color: 'var(--ink-2)' }}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}
      {error && !loading && (
        <div className="p-4 rounded-2xl text-sm flex items-center justify-between"
          style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
          {error}
          <button onClick={loadAll} className="underline text-sm">Retry</button>
        </div>
      )}

      {/* Users tab */}
      {!loading && !error && tab === 'Users' && (
        <div className="tg-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6"
            style={{ borderBottom: '1px solid var(--line)' }}>
            <h2 className="tg-serif text-2xl font-bold">
              Travellers <span style={{ color: 'var(--mute)' }}>({filteredUsers.length})</span>
            </h2>
            <div className="relative w-full sm:w-72">
              <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--mute)' }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
                </svg>
              </span>
              <input className="tg-input pl-11" placeholder="Search name or email…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center" style={{ color: 'var(--mute)' }}>No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {['Traveller', 'Role', 'Joined', 'Status', ''].map((h) => (
                      <th key={h} className="tg-label px-6 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onDelete={handleDelete}
                      onToggleRole={handleToggleRole}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {!loading && !error && tab === 'Analytics' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="tg-card p-8">
            <h2 className="tg-serif text-2xl font-bold mb-5">🗺️ Trips per user</h2>
            {tripsPerUser.length === 0 ? (
              <p style={{ color: 'var(--mute)' }}>No data available.</p>
            ) : (
              <div className="space-y-4">
                {[...tripsPerUser].sort((a, b) => (b.trip_count ?? 0) - (a.trip_count ?? 0)).map((row, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[60%]" style={{ color: 'var(--ink-2)' }}>
                        {row.email || row.user || `User #${i + 1}`}
                      </span>
                      <span className="font-bold">{row.trip_count ?? 0} trips</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--sand)' }}>
                      <div className="h-2.5 rounded-full transition-all"
                        style={{ width: `${((row.trip_count ?? 0) / maxTrips) * 100}%`, background: 'var(--sea)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="tg-card p-8">
            <h2 className="tg-serif text-2xl font-bold mb-5">🏨 Avg hotel price per city</h2>
            {avgHotelPrice.length === 0 ? (
              <p style={{ color: 'var(--mute)' }}>No data available.</p>
            ) : (
              <div className="space-y-4">
                {[...avgHotelPrice].sort((a, b) => parseFloat(b.avg_price ?? 0) - parseFloat(a.avg_price ?? 0)).map((row, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[60%]" style={{ color: 'var(--ink-2)' }}>
                        {row.city || row.destination || `City #${i + 1}`}
                      </span>
                      <span className="font-bold">{money(row.avg_price ?? 0)}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--sand)' }}>
                      <div className="h-2.5 rounded-full transition-all"
                        style={{ width: `${(parseFloat(row.avg_price ?? 0) / maxHotel) * 100}%`, background: 'var(--sun)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
