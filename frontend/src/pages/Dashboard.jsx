import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getTrips } from '../api/trips.js';
import { getExpenses, getSpendByCategory } from '../api/budget.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';


const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STATUS_THEMES = {
  planned:   { color: 'var(--sea)',    bg: 'var(--sea-soft)',   border: 'rgba(31, 122, 140, 0.25)', label: 'Planned' },
  active:    { color: 'var(--moss)',   bg: 'var(--moss-soft)',  border: 'rgba(79, 122, 67, 0.25)',  label: 'Active' },
  completed: { color: 'var(--ink-2)', bg: 'var(--line)',       border: 'rgba(58, 71, 102, 0.2)',   label: 'Completed' },
  cancelled: { color: 'var(--coral)', bg: 'var(--coral-soft)', border: 'rgba(228, 87, 46, 0.25)',  label: 'Cancelled' },
};

const INSPIRATION_IDEAS = [
  {
    city: 'Kyoto, Japan',
    title: 'Autumn Temples & Tea',
    tag: 'Cultural Heritage',
    days: '7 Days',
    accent: 'var(--coral)',
    bg: 'var(--coral-soft)',
    icon: '⛩️',
  },
  {
    city: 'Amalfi Coast, Italy',
    title: 'Cliffside Sailing & Trattorias',
    tag: 'Coastal Luxury',
    days: '5 Days',
    accent: 'var(--sea)',
    bg: 'var(--sea-soft)',
    icon: '⛵',
  },
  {
    city: 'Reykjavik, Iceland',
    title: 'Glacial Lagoons & Auroras',
    tag: 'Wild Expeditions',
    days: '6 Days',
    accent: 'var(--moss)',
    bg: 'var(--moss-soft)',
    icon: '🌋',
  },
  {
    city: 'St. Moritz, Switzerland',
    title: 'Alpine Rails & Fondue',
    tag: 'Mountain Escape',
    days: '4 Days',
    accent: 'var(--sun)',
    bg: 'var(--sun-soft)',
    icon: '🏔️',
  },
];

function Pill({ status }) {
  const t = STATUS_THEMES[status] || STATUS_THEMES.planned;
  return (
    <span
      className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border inline-flex items-center gap-1.5"
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

function BoardingPassTicket({ trip }) {
  const tripId = trip.trip_id || trip.id;
  const nights = Math.max(1, Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 864e5));
  const destCity = trip.destination_detail?.city || (typeof trip.destination === 'string' ? trip.destination : '') || trip.title || 'PAR';
  const airportCode = String(destCity).replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'TGX';
  const countryName = trip.destination_detail?.country || (typeof trip.destination === 'string' && trip.destination.includes(',') ? trip.destination.split(',').pop().trim() : 'Destination');
  const destDisplay = trip.destination_detail ? `${trip.destination_detail.city}, ${trip.destination_detail.country}` : (typeof trip.destination === 'string' ? trip.destination : trip.title);

  return (
    <Link
      to={`/trips/${tripId}`}
      className="tg-card text-left flex flex-col sm:flex-row overflow-hidden group transition hover:-translate-y-1 block shadow-sm hover:shadow-xl relative"
    >
      {/* Main Ticket Area */}
      <div className="flex-1 p-6 md:p-7 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <span className="tg-label flex items-center gap-1.5" style={{ color: 'var(--sea)' }}>
              <span>📍</span> {countryName}
            </span>
            <Pill status={trip.status} />
          </div>

          <h3
            className="tg-serif text-2xl md:text-3xl font-bold group-hover:text-[var(--coral)] transition-colors tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {trip.title}
          </h3>

          <p className="text-xs text-[var(--mute)] mt-1 line-clamp-1 font-medium">
            {destDisplay} · Tailored bespoke itinerary
          </p>
        </div>

        {/* Flight route simulation bar */}
        <div className="mt-6 pt-5 border-t border-dashed flex items-center gap-4" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="tg-label text-[10px]">Departs</div>
            <div className="font-bold text-sm text-[var(--ink)] mt-0.5">{fmt(trip.start_date)}</div>
          </div>

          <div className="flex-1 flex items-center gap-2" style={{ color: 'var(--mute)' }}>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
            <span className="text-xs group-hover:translate-x-1 transition-transform">✈️</span>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
          </div>

          <div className="text-right">
            <div className="tg-label text-[10px]">Returns</div>
            <div className="font-bold text-sm text-[var(--ink)] mt-0.5">{fmt(trip.end_date)}</div>
          </div>
        </div>
      </div>

      {/* Perforated Boarding Stub */}
      <div
        className="tg-perf w-full sm:w-36 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-2 p-5 sm:p-6"
        style={{ background: 'var(--sand)' }}
      >
        <div className="text-left sm:text-center">
          <div className="tg-label text-[10px]">Airport Code</div>
          <div className="tg-serif text-3xl font-bold tracking-tight" style={{ color: 'var(--coral)' }}>
            {airportCode}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-bold text-[var(--ink)]">{nights} Nights</div>
          <div className="text-[10px] text-[var(--mute)] font-medium">Curated Journey</div>
        </div>

        <div className="hidden sm:block w-full border-t border-dashed" style={{ borderColor: 'var(--line)' }} />

        <div className="text-[10px] font-mono tracking-widest text-[var(--mute)] uppercase">
          TG-{tripId?.toString().padStart(4, '0')}
        </div>
      </div>
    </Link>
  );
}

function StatTile({ label, value, hint, icon, color, bg }) {
  return (
    <div className="tg-card p-6 tg-rise flex flex-col justify-between hover:border-[var(--ink)] transition-colors shadow-sm">
      <div className="flex items-center justify-between">
        <span className="tg-label">{label}</span>
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-xs"
          style={{ background: bg, color: color }}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="tg-serif text-4xl md:text-5xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          {value}
        </div>
        <div className="text-xs font-semibold mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--mute)' }}>
          <span>•</span>
          <span>{hint}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [tripsRes, expRes, catRes] = await Promise.allSettled([
          getTrips(),
          getExpenses(),
          getSpendByCategory(),
        ]);

        if (tripsRes.status === 'fulfilled') {
          setTrips(tripsRes.value.data?.results ?? tripsRes.value.data ?? []);
        }
        if (expRes.status === 'fulfilled') {
          setExpenses(expRes.value.data?.results ?? expRes.value.data ?? []);
        }
        if (catRes.status === 'fulfilled') {
          const raw = catRes.value.data?.results ?? catRes.value.data ?? [];
          setByCategory(Array.isArray(raw) ? raw : Object.entries(raw).map(([category, total]) => ({ category, total })));
        }
      } catch {
        setError('Failed to load dashboard records.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    [expenses]
  );

  const activeCount = useMemo(
    () => trips.filter((t) => t.status === 'active').length,
    [trips]
  );

  // Distinct destinations count
  const destinationsCount = useMemo(() => {
    const unique = new Set(
      trips
        .map((t) => (t.destination_detail?.city || (typeof t.destination === 'string' ? t.destination : '') || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return unique.size || (trips.length > 0 ? 1 : 0);
  }, [trips]);

  // Featured trip: closest upcoming trip or the most recently logged trip
  const featuredTrip = useMemo(() => {
    if (!trips.length) return null;
    const today = new Date();
    const future = trips
      .filter((t) => new Date(t.end_date || t.start_date) >= today)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    return future[0] || trips[0];
  }, [trips]);

  const firstName = user?.full_name?.split(' ')[0] || 'Traveler';

  return (
    <div className="space-y-10 tg-rise">
      {/* Luxury Editorial Hero Section */}
      <section
        className="relative overflow-hidden rounded-[32px] p-8 sm:p-12 md:p-14 shadow-2xl border border-[var(--ink)]"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        {/* Subtle Luxury Atmospheric Background Lights */}
        <div
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: 'var(--coral)' }}
        />
        <div
          className="absolute right-48 -bottom-24 h-80 w-80 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'var(--sun)' }}
        />
        <div
          className="absolute left-1/3 top-0 h-64 w-64 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: 'var(--sea)' }}
        />

        {/* Content Layer */}
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            {/* VIP Status Chip */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-5 border"
                 style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'var(--sun)' }}>
              <span className="text-sm">🧭</span>
              <span>First Class Travel Concierge · TG-Club</span>
            </div>

            <h1 className="tg-serif text-4xl sm:text-6xl md:text-7xl font-bold leading-[0.98] tracking-tight">
              Welcome back, {firstName}.<br />
              <em className="font-serif italic font-normal text-[var(--sun)]">Where to next?</em>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[var(--paper)] opacity-80 max-w-lg leading-relaxed">
              Your bespoke itineraries, flight routes, and atmospheric telemetry are synchronized and ready for exploration.
            </p>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <Link
              to="/trips/new"
              className="tg-btn py-3.5 px-6 text-sm font-bold shadow-lg flex-1 sm:flex-initial justify-center"
              style={{ background: 'var(--coral)' }}
            >
              <span>+ Plan Bespoke Trip</span>
            </Link>
            <Link
              to="/map"
              className="tg-ghost py-3.5 px-5 text-sm font-bold flex-1 sm:flex-initial justify-center hover:bg-white hover:text-[var(--ink)]"
            >
              <span>🗺️ World Map</span>
            </Link>
            <Link
              to="/weather"
              className="tg-ghost py-3.5 px-5 text-sm font-bold flex-1 sm:flex-initial justify-center hover:bg-white hover:text-[var(--ink)]"
            >
              <span>⛅ Atmospheric Weather</span>
            </Link>

          </div>
        </div>

        {/* Status Live Ticker Strip */}
        <div
          className="relative z-10 mt-10 pt-6 border-t border-dashed flex flex-wrap items-center justify-between gap-4 text-xs font-semibold opacity-75"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Itinerary Generator Active</span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <span>Open-Meteo Satellite Sync: Online</span>
            <span>Ledger Currency: USD ($)</span>
          </div>
        </div>
      </section>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size="lg" />
          <span className="text-sm font-semibold text-[var(--mute)]">Loading passenger dashboard…</span>
        </div>
      )}

      {error && !loading && (
        <div
          className="p-5 rounded-2xl border text-sm font-semibold flex items-center gap-3"
          style={{ background: 'var(--coral-soft)', borderColor: 'var(--coral)', color: 'var(--coral)' }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatTile
              label="Curated Trips"
              value={trips.length}
              hint={activeCount > 0 ? `${activeCount} in progress` : `${trips.length} registered journeys`}
              icon="🗺️"
              color="var(--sea)"
              bg="var(--sea-soft)"
            />
            <StatTile
              label="Total Investment"
              value={money(totalSpent)}
              hint={`Across ${expenses.length} recorded items`}
              icon="💰"
              color="var(--coral)"
              bg="var(--coral-soft)"
            />
            <StatTile
              label="Destinations"
              value={destinationsCount}
              hint="Cities & countries explored"
              icon="📍"
              color="var(--sun)"
              bg="var(--sun-soft)"
            />
            <StatTile
              label="Next Status"
              value={featuredTrip ? (featuredTrip.status || 'Planned').toUpperCase() : 'NONE'}
              hint={featuredTrip ? featuredTrip.title : 'No active trips'}
              icon="✈️"
              color="var(--moss)"
              bg="var(--moss-soft)"
            />
          </div>

          {/* Featured Expedition Spotlight (if any trip exists) */}
          {featuredTrip && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="tg-label" style={{ color: 'var(--coral)' }}>Spotlight Expedition</div>
                  <h2 className="tg-serif text-2xl md:text-3xl font-bold" style={{ color: 'var(--ink)' }}>
                    Current Itinerary Dossier
                  </h2>
                </div>
                <Link
                  to={`/trips/${featuredTrip.trip_id || featuredTrip.id}`}
                  className="tg-ghost text-xs font-bold py-2 px-4 hover:border-[var(--ink)]"
                >
                  Inspect Full Itinerary →
                </Link>
              </div>

              <BoardingPassTicket trip={featuredTrip} />
            </div>
          )}

          {/* All Journeys Ledger & Financial Snapshot Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns: All Registered Trips */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="tg-label">All Itineraries</div>
                  <h2 className="tg-serif text-2xl md:text-3xl font-bold" style={{ color: 'var(--ink)' }}>
                    Your Travel Ledger
                  </h2>
                </div>
                <Link
                  to="/trips"
                  className="text-xs font-bold uppercase tracking-wider text-[var(--coral)] hover:underline inline-flex items-center gap-1"
                >
                  View All ({trips.length}) →
                </Link>
              </div>

              {trips.length === 0 ? (
                <div className="tg-card py-16 px-6 text-center">
                  <span className="text-5xl block mb-3 tg-float">🌍</span>
                  <h3 className="tg-serif text-2xl font-bold text-[var(--ink)]">No expeditions recorded</h3>
                  <p className="text-sm text-[var(--mute)] mt-1 max-w-sm mx-auto">
                    Your passport is blank! Use our intelligent AI planner to generate your first complete itinerary in seconds.
                  </p>
                  <Link to="/trips/new" className="tg-btn mt-6 inline-flex text-xs py-2.5 px-5">
                    + Plan Your First Journey
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {trips.slice(0, 3).map((t) => (
                    <BoardingPassTicket key={t.trip_id || t.id} trip={t} />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Financial Snapshot & Curated Ideas */}
            <div className="space-y-6">
              {/* Atmospheric Weather Live Widget */}
              <WeatherWidget
                city={featuredTrip?.destination_detail?.city || (typeof featuredTrip?.destination === 'string' ? featuredTrip.destination.split(',')[0].trim() : 'Kyoto')}
                country={featuredTrip?.destination_detail?.country || ''}
                tripId={featuredTrip?.trip_id || featuredTrip?.id}
              />

              {/* Financial Snapshot Card */}
              <div className="tg-card p-6 shadow-sm">

                <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <div className="tg-label" style={{ color: 'var(--sea)' }}>Budget Snapshot</div>
                    <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                      Spend Breakdown
                    </h3>
                  </div>
                  <Link
                    to="/budget"
                    className="text-xs font-bold uppercase tracking-wider text-[var(--sea)] hover:underline"
                  >
                    Open Ledger →
                  </Link>
                </div>

                <div className="tg-serif text-3xl font-bold mb-4" style={{ color: 'var(--ink)' }}>
                  {money(totalSpent)}
                  <span className="text-xs font-sans text-[var(--mute)] font-medium ml-2">Total Logged</span>
                </div>

                {byCategory.length === 0 ? (
                  <p className="text-xs text-[var(--mute)] py-4 text-center">
                    No expense categories recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {byCategory.slice(0, 4).map(({ category, total }) => {
                      const pct = totalSpent > 0 ? Math.round((parseFloat(total) / totalSpent) * 100) : 0;
                      return (
                        <div key={category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="capitalize text-[var(--ink)]">{category}</span>
                            <span className="text-[var(--mute)]">{money(total)} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden bg-[var(--sand)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: category === 'food' ? 'var(--sun)' : category === 'transport' ? 'var(--coral)' : 'var(--sea)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inspiration Presets Card */}
              <div className="tg-card p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div>
                    <div className="tg-label" style={{ color: 'var(--coral)' }}>AI Travel Studio</div>
                    <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                      Inspiration Presets
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {INSPIRATION_IDEAS.map((idea) => (
                    <button
                      key={idea.title}
                      onClick={() => navigate('/trips/new')}
                      className="w-full text-left p-3 rounded-2xl border transition hover:border-[var(--ink)] hover:-translate-y-0.5 flex items-center justify-between group"
                      style={{ background: 'var(--sand)', borderColor: 'var(--line)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">{idea.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[var(--ink)] group-hover:text-[var(--coral)] transition-colors truncate">
                            {idea.title}
                          </div>
                          <div className="text-[10px] text-[var(--mute)] truncate">{idea.city}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--ink-2)] flex-shrink-0 ml-2">
                        {idea.days} →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
