import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrips, deleteTrip } from '../api/trips.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_COLORS = {
  planned:   ['var(--sea)',    'var(--sea-soft)'],
  active:    ['var(--moss)',   'var(--moss-soft)'],
  ongoing:   ['var(--moss)',   'var(--moss-soft)'],
  completed: ['var(--ink-2)', 'var(--line)'],
  cancelled: ['var(--coral)', 'var(--coral-soft)'],
};

function Pill({ status }) {
  const [c, bg] = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
      style={{ color: c, background: bg }}>{status}</span>
  );
}

function TripTicket({ trip, onDelete, deletingId }) {
  const tripId = trip.trip_id || trip.id;
  const nights = Math.max(1, Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 864e5));
  const code   = (trip.destination_detail?.city || trip.title || '???').slice(0, 3).toUpperCase();
  const country = trip.destination_detail?.country || (typeof trip.destination === 'string' && trip.destination.includes(',') ? trip.destination.split(',').pop().trim() : 'Destination');
  const isDeleting = deletingId === tripId;

  return (
    <div className="tg-card text-left flex overflow-hidden group transition hover:-translate-y-1 relative">
      <Link to={`/trips/${tripId}`} className="flex-1 p-6 flex flex-col justify-between block">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="tg-label">{country}</div>
              <h3 className="tg-serif text-2xl font-bold mt-1 group-hover:underline decoration-[var(--coral)] underline-offset-4"
                style={{ color: 'var(--ink)' }}>{trip.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Pill status={trip.status} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div>
            <div className="tg-label">Depart</div>
            <div className="font-bold text-sm">{fmt(trip.start_date)}</div>
          </div>
          <div className="flex-1 flex items-center gap-2" style={{ color: 'var(--mute)' }}>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16l20-8-20-8 4 8-4 8zm4-8h16" />
            </svg>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
          </div>
          <div className="text-right">
            <div className="tg-label">Return</div>
            <div className="font-bold text-sm">{fmt(trip.end_date)}</div>
          </div>
        </div>
      </Link>

      {/* Perforation stub + Delete button */}
      <div className="tg-perf w-28 flex flex-col items-center justify-between p-4"
        style={{ background: 'var(--sand)' }}>
        <div className="text-center">
          <div className="tg-serif text-3xl font-bold" style={{ color: 'var(--coral)' }}>{code}</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--mute)' }}>{nights} nights</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{trip.status || 'planned'}</div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(tripId, trip.title);
          }}
          disabled={isDeleting}
          title="Delete trip permanently"
          className="mt-2 w-8 h-8 rounded-full flex items-center justify-center transition opacity-60 hover:opacity-100 hover:bg-[var(--coral-soft)] text-[var(--mute)] hover:text-[var(--coral)] border border-transparent hover:border-[var(--coral)]"
        >
          {isDeleting ? (
            <span className="text-xs">…</span>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

const STATUS_FILTERS = ['all', 'planned', 'active', 'completed', 'cancelled'];

export default function Trips() {
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadTrips = async () => {
    setLoading(true); setError('');
    try {
      const res = await getTrips();
      setTrips(res.data?.results ?? res.data ?? []);
    } catch { setError('Failed to load trips. Please try again.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const handleDeleteTrip = async (id, title) => {
    if (!window.confirm(`Permanently delete "${title}"?\n\nThis will remove its entire itinerary, expenses, and bookings from everywhere.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteTrip(id);
      setTrips((prev) => prev.filter((t) => (t.trip_id || t.id) !== id));
    } catch {
      alert('Failed to delete trip. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => trips.filter((t) => {
    let matchStatus = false;
    if (filter === 'all') {
      matchStatus = true;
    } else if (filter === 'active') {
      matchStatus = t.status === 'active' || t.status === 'ongoing';
    } else {
      matchStatus = t.status === filter;
    }

    const s = search.toLowerCase();
    const destStr = (t.destination_detail?.city || t.destination_detail?.country || (typeof t.destination === 'string' ? t.destination : '') || '').toLowerCase();
    const matchSearch = !search ||
      t.title?.toLowerCase().includes(s) ||
      destStr.includes(s);
    return matchStatus && matchSearch;
  }), [trips, filter, search]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 tg-rise">
        <div>
          <div className="tg-label mb-3" style={{ color: 'var(--coral)' }}>Your journeys</div>
          <h1 className="tg-serif text-5xl md:text-6xl font-bold leading-[0.95]">My Trips</h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--ink-2)' }}>
            {trips.length} trip{trips.length !== 1 ? 's' : ''} in your passport
          </p>
        </div>
        <Link to="/trips/new" className="tg-btn">+ New trip</Link>
      </div>

      {/* Filters with dynamic count badges */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full md:w-80">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--mute)' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
            </svg>
          </span>
          <input className="tg-input pl-11" placeholder="Search title or destination…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {STATUS_FILTERS.map((s) => {
          let count = trips.length;
          if (s === 'active') {
            count = trips.filter((t) => t.status === 'active' || t.status === 'ongoing').length;
          } else if (s !== 'all') {
            count = trips.filter((t) => t.status === s).length;
          }
          return (
            <button
              key={s}
              data-on={filter === s}
              onClick={() => setFilter(s)}
              className="tg-ghost text-sm capitalize inline-flex items-center gap-1.5"
            >
              <span>{s}</span>
              <span className="text-xs opacity-70 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}

      {error && !loading && (
        <div className="p-4 rounded-2xl text-sm flex items-center justify-between"
          style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
          {error}
          <button onClick={() => window.location.reload()} className="underline text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="tg-card tg-grain py-20 text-center">
          <div className="tg-float inline-flex h-20 w-20 items-center justify-center rounded-full mb-5 text-4xl"
            style={{ background: 'var(--coral-soft)' }}>🧳</div>
          <p className="tg-serif text-2xl font-semibold">
            {trips.length === 0 ? 'No trips yet.' : `No ${filter} trips match your filters.`}
          </p>
          <p className="text-xs text-[var(--mute)] mt-1.5 max-w-sm mx-auto">
            {filter === 'active'
              ? 'None of your trips are currently marked as Active. You can update any trip\'s status to Active directly from its details page.'
              : 'Try selecting "All" or adjusting your search keywords.'}
          </p>
          {trips.length === 0 && (
            <Link to="/trips/new" className="mt-4 font-semibold inline-flex items-center gap-1"
              style={{ color: 'var(--coral)' }}>Plan your first trip with AI →</Link>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((trip) => (
            <TripTicket
              key={trip.trip_id || trip.id}
              trip={trip}
              onDelete={handleDeleteTrip}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
