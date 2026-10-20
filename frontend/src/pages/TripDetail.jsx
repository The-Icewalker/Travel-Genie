import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getTripById,
  getItinerary,
  getTripBookings,
  getTripCostSummary,
  updateTrip,
  deleteTrip,
  addTripDay,
  removeTripDay,
  resetTripItinerary,
  addItineraryCost,
  removeItineraryCost,
} from '../api/trips.js';
import { generateTripPlan } from '../api/ai.js';
import WeatherWidget from '../components/WeatherWidget.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Fix Leaflet default icon path for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const createMarkerIcon = (color = '#0284c7', label = '') => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 10px;
          font-weight: 700;
          font-family: sans-serif;
        ">${label}</span>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
};

const STATUS_COLORS = {
  planned:   ['var(--sea)',    'var(--sea-soft)'],
  active:    ['var(--moss)',   'var(--moss-soft)'],
  completed: ['var(--ink-2)', 'var(--line)'],
  cancelled: ['var(--coral)', 'var(--coral-soft)'],
};

function Pill({ status }) {
  const [c, bg] = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span
      className="text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full"
      style={{ color: c, background: bg }}
    >
      {status || 'planned'}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function money(n) {
  return Number(n || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function BookingVoucher({ booking }) {
  const typeIcons = {
    hotel: '🏨',
    flight: '✈️',
    activity: '🎟️',
    train: '🚆',
  };
  const icon = typeIcons[booking.type?.toLowerCase()] || '🎫';

  return (
    <div
      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition hover:border-[var(--ink)]"
      style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'var(--sand)' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
            {booking.name || booking.title || 'Reserved Item'}
          </p>
          <p className="text-xs capitalize font-medium" style={{ color: 'var(--mute)' }}>
            {booking.type || 'Booking'}
          </p>
        </div>
      </div>
      {booking.price != null && (
        <span className="font-bold text-sm flex-shrink-0" style={{ color: 'var(--ink)' }}>
          {money(booking.price)}
        </span>
      )}
    </div>
  );
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [costSummary, setCostSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [packingList, setPackingList] = useState([]);
  const [showPromptDrawer, setShowPromptDrawer] = useState(false);
  const [selectedDay, setSelectedDay] = useState('all');
  const [addingCostId, setAddingCostId] = useState(null);
  const [addingDayCost, setAddingDayCost] = useState(null);
  const [addingAllCosts, setAddingAllCosts] = useState(false);

  const mappedPoints = useMemo(() => {
    const points = [];
    (itinerary || []).forEach((day) => {
      const dNum = day.day_number || 1;
      (day.items || []).forEach((item) => {
        const lat = item.lat != null ? parseFloat(item.lat) : (item.attraction_detail?.lat ? parseFloat(item.attraction_detail.lat) : null);
        const lng = item.lng != null ? parseFloat(item.lng) : (item.attraction_detail?.lng ? parseFloat(item.attraction_detail.lng) : null);
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          points.push({
            id: item.id || item.item_id,
            title: item.title,
            attractionName: item.attraction_name,
            dayNumber: dNum,
            time: item.time || (item.start_time ? String(item.start_time).slice(0, 5) : null),
            cost: item.est_cost,
            lat,
            lng,
          });
        }
      });
    });
    return points;
  }, [itinerary]);

  const handleAddCostToBudget = async (itemId) => {
    setAddingCostId(itemId);
    try {
      const res = await addItineraryCost(id, { itemId });
      if (res.data?.days) {
        setItinerary(res.data.days);
      }
      try {
        const costRes = await getTripCostSummary(id);
        if (costRes?.data) setCostSummary(costRes.data);
      } catch {}
    } catch {
      alert('Failed to add activity cost to budget.');
    } finally {
      setAddingCostId(null);
    }
  };

  const handleAddDayCostsToBudget = async (dayId, dayNumber) => {
    setAddingDayCost(dayId || dayNumber);
    try {
      const res = await addItineraryCost(id, { dayId, dayNumber });
      if (res.data?.days) {
        setItinerary(res.data.days);
      }
      try {
        const costRes = await getTripCostSummary(id);
        if (costRes?.data) setCostSummary(costRes.data);
      } catch {}
    } catch {
      alert('Failed to add day costs to budget.');
    } finally {
      setAddingDayCost(null);
    }
  };

  const handleAddAllCostsToBudget = async () => {
    setAddingAllCosts(true);
    try {
      const res = await addItineraryCost(id);
      if (res.data?.days) {
        setItinerary(res.data.days);
      }
      try {
        const costRes = await getTripCostSummary(id);
        if (costRes?.data) setCostSummary(costRes.data);
      } catch {}
    } catch {
      alert('Failed to add all costs to budget.');
    } finally {
      setAddingAllCosts(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await updateTrip(id, { status: newStatus });
      setTrip((prev) => ({ ...prev, status: newStatus }));
    } catch {
      alert('Failed to update trip status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!window.confirm(`Permanently delete "${trip.title}"?\n\nThis will remove its itinerary, bookings, and budget records from everywhere.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteTrip(id);
      navigate('/trips', { replace: true });
    } catch {
      alert('Failed to delete trip.');
      setDeleting(false);
    }
  };

  const handleGenerateItinerary = async (overridePrompt, overrideDay) => {
    setGeneratingPlan(true);
    try {
      const promptToUse = overridePrompt !== undefined ? overridePrompt : (promptInput || trip?.prompt_text || '');
      const dayParam = overrideDay !== undefined ? overrideDay : (selectedDay === 'all' ? null : parseInt(selectedDay, 10));
      const res = await generateTripPlan(id, promptToUse, dayParam);
      const generated = res.data;
      if (generated?.days?.length > 0) {
        setItinerary(generated.days);
      }
      if (generated?.packing_list) {
        setPackingList(generated.packing_list);
      }
      // Re-fetch cost summary
      try {
        const costRes = await getTripCostSummary(id);
        if (costRes?.data) setCostSummary(costRes.data);
      } catch {}
      setShowPromptDrawer(false);
    } catch {
      alert('Failed to generate itinerary. Please try again.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleAddDay = async () => {
    try {
      const res = await addTripDay(id);
      if (res.data?.trip) setTrip(res.data.trip);
      if (res.data?.days) setItinerary(res.data.days);
    } catch {
      alert('Failed to add day.');
    }
  };

  const handleRemoveDay = async (dayNum, dayId) => {
    if (!window.confirm(`Are you sure you want to remove Day ${dayNum}? The trip length will be adjusted.`)) {
      return;
    }
    try {
      const res = await removeTripDay(id, dayNum, dayId);
      if (res.data?.trip) setTrip(res.data.trip);
      if (res.data?.days) setItinerary(res.data.days);
      if (selectedDay === String(dayNum)) setSelectedDay('all');
    } catch {
      alert('Failed to remove day.');
    }
  };

  const handleResetItinerary = async () => {
    if (!window.confirm('Reset and clear the entire daily schedule to start fresh with a new AI prompt?')) {
      return;
    }
    try {
      const res = await resetTripItinerary(id);
      if (res.data?.trip) setTrip(res.data.trip);
      setItinerary([]);
      setPromptInput('');
      setSelectedDay('all');
      setShowPromptDrawer(false);
    } catch {
      alert('Failed to reset itinerary.');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [tripRes, itiRes, bookRes, costRes] = await Promise.allSettled([
          getTripById(id),
          getItinerary(id),
          getTripBookings(id),
          getTripCostSummary(id),
        ]);

        if (tripRes.status === 'fulfilled') {
          const t = tripRes.value.data;
          setTrip(t);
          if (t.prompt_text) setPromptInput(t.prompt_text);
          if (t.days && t.days.length > 0) {
            setItinerary(t.days);
          }
        }
        if (itiRes.status === 'fulfilled') {
          const d = itiRes.value.data;
          const days = d?.results ?? d ?? [];
          if (days.length > 0) {
            setItinerary(days);
          }
        }
        if (bookRes.status === 'fulfilled') {
          const d = bookRes.value.data;
          setBookings(d?.results ?? d ?? []);
        }
        if (costRes.status === 'fulfilled') setCostSummary(costRes.value.data);
        if (tripRes.status === 'rejected') setError('Trip not found or access denied.');
      } catch {
        setError('Failed to load trip details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Geocode destination name → lat/lon via Open-Meteo geocoding API
  useEffect(() => {
    const cityName = trip?.destination_detail?.city || (typeof trip?.destination === 'string' ? trip.destination.split(',')[0].trim() : trip?.title);
    if (!cityName) return;

    // Check if attraction already has lat/lng
    const attr = trip.destination_detail?.attractions?.find(a => a.lat && a.lng);
    if (attr) {
      setCoords({ lat: Number(attr.lat), lon: Number(attr.lng) });
      return;
    }

    const geocode = async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            cityName
          )}&count=1&language=en&format=json`
        );
        const data = await res.json();
        if (data.results?.length > 0) {
          const { latitude, longitude } = data.results[0];
          setCoords({ lat: latitude, lon: longitude });
        }
      } catch {
        // Geocoding fails silently
      }
    };
    geocode();
  }, [trip]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold text-[var(--mute)]">Fetching trip dossier…</span>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="tg-card text-center py-16 text-[var(--coral)] max-w-lg mx-auto">
        <span className="text-4xl block mb-3">⚠️</span>
        <p className="text-lg font-bold">{error || 'Trip not found.'}</p>
        <Link to="/trips" className="mt-4 inline-block tg-btn text-xs py-2 px-4">
          ← Return to All Trips
        </Link>
      </div>
    );
  }

  const nights = Math.max(
    1,
    Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 864e5)
  );
  const destCode = (trip.destination_detail?.city || trip.destination || 'DEST')
    .slice(0, 3)
    .toUpperCase();

  return (
    <div className="space-y-8 tg-rise">
      {/* Navigation Breadcrumb & Status Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/trips"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
        >
          <span>←</span> Back to Trips Ledger
        </Link>

        <div className="flex items-center gap-2.5">
          <span className="tg-label text-[10px]">Status:</span>
          <select
            value={trip.status || 'planned'}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            className="tg-ghost text-xs py-1.5 px-3 font-bold cursor-pointer capitalize"
          >
            <option value="planned">Planned</option>
            <option value="active">Active (Ongoing)</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Pill status={trip.status} />

          <button
            type="button"
            onClick={handleDeleteTrip}
            disabled={deleting}
            title="Permanently remove this trip and its itinerary"
            className="tg-ghost text-xs py-1.5 px-3 font-bold text-[var(--coral)] hover:bg-[var(--coral-soft)] hover:border-[var(--coral)] transition-colors inline-flex items-center gap-1.5 cursor-pointer ml-1"
          >
            <span>🗑️</span>
            <span>{deleting ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>
      </div>

      {/* Boarding Pass Hero Ticket Header */}
      <div className="tg-card overflow-hidden flex flex-col md:flex-row shadow-xl">
        <div className="flex-1 p-7 md:p-9">
          <div className="tg-label mb-2" style={{ color: 'var(--coral)' }}>
            Itinerary Dossier
          </div>
          <h1 className="tg-serif text-3xl md:text-5xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
            {trip.title}
          </h1>
          <p className="text-base font-semibold mt-2 flex items-center gap-2" style={{ color: 'var(--sea)' }}>
            <span>📍</span> {trip.destination_detail ? `${trip.destination_detail.city}, ${trip.destination_detail.country}` : trip.destination}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-6 pt-6 border-t" style={{ borderColor: 'var(--line)' }}>
            <div>
              <div className="tg-label">Departure</div>
              <div className="font-bold text-sm mt-0.5">{formatDate(trip.start_date)}</div>
            </div>
            <div className="flex-1 min-w-[60px] flex items-center gap-2 text-[var(--mute)]">
              <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
              <span>✈️</span>
              <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
            </div>
            <div>
              <div className="tg-label">Return</div>
              <div className="font-bold text-sm mt-0.5">{formatDate(trip.end_date)}</div>
            </div>
          </div>
        </div>

        {/* Perforated Stub */}
        <div
          className="tg-perf w-full md:w-48 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 p-6 md:p-8"
          style={{ background: 'var(--sand)' }}
        >
          <div className="text-left md:text-center">
            <div className="tg-label">Airport Code</div>
            <div className="tg-serif text-4xl font-bold" style={{ color: 'var(--coral)' }}>
              {destCode}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-[var(--ink)]">{nights} Nights</div>
            <div className="text-xs text-[var(--mute)] font-medium">Scheduled Stay</div>
          </div>
          <div className="hidden md:block w-full border-t border-dashed" style={{ borderColor: 'var(--line)' }} />
          <div className="text-xs font-mono tracking-widest text-[var(--mute)] uppercase">
            TG-{trip.id?.toString().padStart(4, '0')}
          </div>
        </div>
      </div>

      {/* Atmospheric Weather Widget */}
      <WeatherWidget
        lat={coords?.lat}
        lon={coords?.lon}
        city={trip?.destination_detail?.city || (typeof trip?.destination === 'string' ? trip.destination : trip?.title)}
        country={trip?.destination_detail?.country || ''}
        tripId={trip.trip_id || trip.id}
      />


      {/* Cost Summary Ledger */}
      {costSummary && (
        <div className="tg-card p-7 shadow-md">
          <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
            <div>
              <div className="tg-label" style={{ color: 'var(--sea)' }}>Financial Ledger</div>
              <h2 className="tg-serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                Cost Breakdown
              </h2>
            </div>
            {costSummary.grand_total != null && (
              <div className="text-right">
                <div className="tg-label">Grand Total</div>
                <div className="tg-serif text-2xl md:text-3xl font-bold" style={{ color: 'var(--coral)' }}>
                  {money(costSummary.grand_total)}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Flights', value: costSummary.flights_total, icon: '✈️' },
              { label: 'Accommodations', value: costSummary.hotels_total, icon: '🏨' },
              { label: 'Activities', value: costSummary.activities_total, icon: '🎟️' },
              { label: 'Expenses', value: costSummary.expenses_total, icon: '☕' },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="p-4 rounded-2xl border"
                style={{ background: 'var(--sand)', borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between text-xs text-[var(--mute)] font-bold uppercase tracking-wider">
                  <span>{label}</span>
                  <span>{icon}</span>
                </div>
                <p className="tg-serif text-xl md:text-2xl font-bold mt-2" style={{ color: 'var(--ink)' }}>
                  {money(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Itinerary Timeline & Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Itinerary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="tg-serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                Curated Daily Timeline
              </h2>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                {itinerary.length} Days Planned
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddDay}
                title="Add a new day to this trip"
                className="tg-ghost text-xs py-1.5 px-3 font-bold text-[var(--sea)] hover:border-[var(--sea)] cursor-pointer inline-flex items-center gap-1.5 transition"
              >
                <span>➕</span>
                <span>Add Day</span>
              </button>

              {itinerary.length > 0 && (
                <>
                  {itinerary.flatMap((d) => d.items || []).some((it) => parseFloat(it.est_cost || 0) > 0 && !it.is_in_budget) && (
                    <button
                      type="button"
                      onClick={handleAddAllCostsToBudget}
                      disabled={addingAllCosts}
                      title="Add all activity costs across the trip to your budget"
                      className="tg-ghost text-xs py-1.5 px-3 font-bold text-[var(--coral)] hover:bg-[var(--coral-soft)] hover:border-[var(--coral)] cursor-pointer inline-flex items-center gap-1.5 transition"
                    >
                      <span>💰</span>
                      <span>{addingAllCosts ? 'Adding…' : 'Add All Costs to Budget'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPromptDrawer(!showPromptDrawer)}
                    className="tg-ghost text-xs py-1.5 px-3 font-bold inline-flex items-center gap-1.5 transition hover:border-[var(--ink)] cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>{showPromptDrawer ? 'Close Concierge' : 'Concierge Planner'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetItinerary}
                    title="Clear current timeline and re-curate from scratch"
                    className="tg-ghost text-xs py-1.5 px-2.5 font-bold text-[var(--coral)] hover:bg-[var(--coral-soft)] hover:border-[var(--coral)] cursor-pointer inline-flex items-center gap-1 transition"
                  >
                    <span>🔄</span>
                    <span>Start Fresh</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Regenerate Drawer if itinerary already exists */}
          {showPromptDrawer && (
            <div className="tg-card p-5 border-2 border-[var(--ink)] shadow-md space-y-3.5 tg-rise">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                  <span>⚡</span> AI Concierge Itinerary Planner
                </span>
                <button
                  type="button"
                  onClick={() => setShowPromptDrawer(false)}
                  className="text-xs font-bold text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Day Scope Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <span className="tg-label text-[10px]">Target Scope:</span>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="tg-ghost text-xs py-1 px-2.5 font-bold cursor-pointer"
                  >
                    <option value="all">🗓️ Full Trip (All Days)</option>
                    {itinerary.map((d, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        Day {i + 1} only {d.date ? `(${formatDate(d.date)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] font-semibold text-[var(--sea)]">
                  {selectedDay === 'all'
                    ? '✨ Whole Trip Cohesive Curation'
                    : `🎯 Curating Day ${selectedDay} specifically`}
                </span>
              </div>

              <textarea
                rows={2}
                placeholder={
                  selectedDay === 'all'
                    ? "E.g., 'Focus the trip on waterfalls, nature and hiking', or 'Day 3: Waterfalls, Day 4: Fondue'..."
                    : `E.g., Specific wish for Day ${selectedDay} (e.g. 'Visit roaring waterfalls nearby and have a lakeside picnic')...`
                }
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ink)] resize-none"
                style={{ background: 'var(--sand)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[var(--mute)] font-medium">
                  {selectedDay === 'all'
                    ? 'Tip: You can specify "Day 3: Waterfalls, Day 4: Fondue" directly in the prompt.'
                    : `Only Day ${selectedDay} will be replaced; other days remain preserved.`}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPromptDrawer(false)}
                    className="tg-ghost text-xs py-1.5 px-3 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateItinerary()}
                    disabled={generatingPlan}
                    className="tg-btn text-xs py-2 px-4 font-bold flex items-center gap-2 cursor-pointer"
                  >
                    {generatingPlan ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Curating…</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>{selectedDay === 'all' ? 'Curate All Days' : `Update Day ${selectedDay}`}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {itinerary.length === 0 ? (
            <div className="tg-card p-8 md:p-10 text-center relative overflow-hidden shadow-lg border-2 border-dashed border-[var(--sand-dark)]">
              <div className="max-w-md mx-auto space-y-4">
                <div
                  className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-sm"
                  style={{ background: 'var(--sand)' }}
                >
                  ✨
                </div>
                <div>
                  <h3 className="tg-serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                    No daily schedule recorded yet
                  </h3>
                  <p className="text-xs text-[var(--mute)] mt-1.5 leading-relaxed">
                    Let our AI Concierge curate a bespoke, day-by-day itinerary tailored to{' '}
                    <span className="font-semibold text-[var(--ink)]">
                      {trip.destination_detail ? `${trip.destination_detail.city}, ${trip.destination_detail.country}` : trip.destination || 'your destination'}
                    </span>
                    .
                  </p>
                </div>

                <div className="space-y-3 pt-2 text-left">
                  <label className="tg-label block text-[11px]">
                    Travel Preferences & Highlights (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="E.g., 'Focus the entire trip on waterfalls and alpine nature', or specify 'Day 2: Waterfalls, Day 3: Glacier train, Day 4: Fondue'..."
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    className="w-full text-xs p-3.5 rounded-xl border font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ink)] resize-none"
                    style={{ background: 'var(--paper)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateItinerary()}
                    disabled={generatingPlan}
                    className="tg-btn w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                  >
                    {generatingPlan ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Curating Bespoke Itinerary…</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>Curate Itinerary with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {itinerary.map((day, idx) => {
                const itemsWithCost = (day.items || []).filter((it) => parseFloat(it.est_cost || 0) > 0);
                const allCostsAdded = itemsWithCost.length > 0 && itemsWithCost.every((it) => it.is_in_budget);
                const hasUnaddedCosts = itemsWithCost.some((it) => !it.is_in_budget);

                return (
                  <div key={day.id ?? idx} className="tg-card p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b gap-2" style={{ borderColor: 'var(--line)' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl font-bold text-sm flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: 'var(--ink)' }}
                        >
                          {idx + 1}
                        </div>
                        <h3 className="tg-serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                          Day {idx + 1} {day.summary ? `— ${day.summary}` : ''}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        {day.date && (
                          <span className="text-xs font-semibold text-[var(--mute)]">
                            {formatDate(day.date)}
                          </span>
                        )}
                        {hasUnaddedCosts && (
                          <button
                            type="button"
                            onClick={() => handleAddDayCostsToBudget(day.id || day.day_id, idx + 1)}
                            disabled={addingDayCost === (day.id || day.day_id || idx + 1)}
                            title={`Add all Day ${idx + 1} activity costs to Budget Tracker`}
                            className="tg-ghost text-[10px] py-1 px-2.5 font-bold cursor-pointer inline-flex items-center gap-1 transition"
                            style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
                          >
                            <span>💰</span>
                            <span>{addingDayCost === (day.id || day.day_id || idx + 1) ? 'Adding…' : `Add Day ${idx + 1} Costs`}</span>
                          </button>
                        )}
                        {allCostsAdded && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ background: 'var(--moss-soft)', color: 'var(--moss)' }}
                          >
                            <span>✓</span> Day Budgeted
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDay(String(idx + 1));
                            setShowPromptDrawer(true);
                            window.scrollTo({ top: 350, behavior: 'smooth' });
                          }}
                          title={`Customize Day ${idx + 1} with AI`}
                          className="tg-ghost text-[10px] py-1 px-2.5 font-bold text-[var(--sea)] hover:border-[var(--sea)] cursor-pointer inline-flex items-center gap-1 transition"
                        >
                          <span>✏️</span>
                          <span>Customize Day {idx + 1}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDay(idx + 1, day.id || day.day_id)}
                          title={`Remove Day ${idx + 1} from this trip`}
                          className="tg-ghost text-[10px] py-1 px-2 font-bold text-[var(--coral)] hover:bg-[var(--coral-soft)] hover:border-[var(--coral)] cursor-pointer inline-flex items-center gap-1 transition"
                        >
                          <span>🗑️</span>
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {day.items?.length > 0 ? (
                      <div className="space-y-3">
                        {day.items.map((item, i) => (
                          <div key={item.id ?? i} className="flex items-center justify-between gap-3 text-sm py-0.5">
                            <div className="flex items-start gap-3 min-w-0">
                              {item.time ? (
                                <span
                                  className="font-mono text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                                  style={{ background: 'var(--sand)', color: 'var(--ink)' }}
                                >
                                  {item.time}
                                </span>
                              ) : (
                                <span className="text-[var(--coral)] mt-0.5">•</span>
                              )}
                              <div className="text-[var(--ink-2)] leading-relaxed">
                                {item.description || item.title || JSON.stringify(item)}
                              </div>
                            </div>
                            {parseFloat(item.est_cost || 0) > 0 && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-[var(--ink)]">
                                  {money(item.est_cost)}
                                </span>
                                {item.is_in_budget ? (
                                  <span
                                    title="Tracked in Budget Tracker"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'var(--moss-soft)', color: 'var(--moss)' }}
                                  >
                                    <span>✓</span> In Budget
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddCostToBudget(item.id || item.item_id)}
                                    disabled={addingCostId === (item.id || item.item_id)}
                                    title="Add this activity's cost to Budget Tracker"
                                    className="tg-ghost text-[10px] py-0.5 px-2 font-bold cursor-pointer inline-flex items-center gap-1 transition hover:border-[var(--ink)]"
                                    style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
                                  >
                                    <span>+</span> {addingCostId === (item.id || item.item_id) ? 'Adding…' : 'Add Cost'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : day.description ? (
                      <p className="text-sm text-[var(--ink-2)] leading-relaxed">{day.description}</p>
                    ) : (
                      <p className="text-xs text-[var(--mute)]">No recorded excursions for this day.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Map & Bookings & Packing List */}
        <div className="space-y-6">
          {/* Packing List */}
          {packingList.length > 0 && (
            <div className="tg-card p-6 shadow-md border-l-4 border-l-[var(--coral)]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                <h2 className="tg-serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  🎒 Packing Essentials
                </h2>
                <span className="text-xs font-bold" style={{ color: 'var(--sea)' }}>
                  {packingList.length} Items
                </span>
              </div>
              <ul className="space-y-2 text-xs font-medium text-[var(--ink-2)]">
                {packingList.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[var(--moss)] font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Map Preview */}
          {(coords || mappedPoints.length > 0) && (
            <div className="tg-card overflow-hidden shadow-md">
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
                <div>
                  <span className="tg-label">Interactive Trip Map</span>
                  <p className="text-xs text-[var(--mute)]">
                    {mappedPoints.length > 0
                      ? `${mappedPoints.length} planned locations pinned`
                      : coords ? `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°` : 'Destination center'}
                  </p>
                </div>
                <Link
                  to="/map"
                  className="tg-btn tg-btn-secondary text-xs px-2.5 py-1"
                >
                  Full Map ↗
                </Link>
              </div>
              <MapContainer
                center={
                  mappedPoints.length > 0
                    ? [mappedPoints[0].lat, mappedPoints[0].lng]
                    : [coords?.lat || 0, coords?.lon || 0]
                }
                zoom={mappedPoints.length > 0 ? 12 : 11}
                style={{ height: '280px', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {coords && (
                  <Marker position={[coords.lat, coords.lon]}>
                    <Popup>
                      <strong>{trip.destination}</strong>
                      <br />
                      <span className="text-xs text-gray-500">Destination Center</span>
                    </Popup>
                  </Marker>
                )}
                {mappedPoints.map((pt, idx) => (
                  <Marker
                    key={pt.id || idx}
                    position={[pt.lat, pt.lng]}
                    icon={createMarkerIcon(
                      pt.title.toLowerCase().includes('kitchen') || pt.title.toLowerCase().includes('dinner') || pt.title.toLowerCase().includes('lunch')
                        ? '#ea580c'
                        : '#0284c7',
                      `D${pt.dayNumber}`
                    )}
                  >
                    <Popup>
                      <div className="p-1 max-w-[210px] space-y-1">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 mb-1">
                          Day {pt.dayNumber} {pt.time ? `• ${pt.time}` : ''}
                        </span>
                        <h4 className="font-semibold text-xs leading-snug">{pt.title}</h4>
                        {pt.attractionName && (
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            📍 {pt.attractionName}
                          </p>
                        )}
                        {pt.cost > 0 && (
                          <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                            Est. ${Number(pt.cost).toFixed(0)}
                          </p>
                        )}
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              (pt.attractionName || pt.title) + (trip?.destination ? ', ' + trip.destination : '')
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
                            style={{ textDecoration: 'none' }}
                          >
                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <span>Open in Google Maps ↗</span>
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* Bookings & Vouchers */}
          <div className="tg-card p-6 shadow-md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
              <h2 className="tg-serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                Passes & Bookings
              </h2>
              <span className="text-xs font-bold" style={{ color: 'var(--mute)' }}>
                {bookings.length} Confirmed
              </span>
            </div>

            {bookings.length === 0 ? (
              <p className="text-xs text-[var(--mute)] py-4 text-center">
                No tickets or vouchers registered for this trip.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bookings.map((b, i) => (
                  <BookingVoucher key={b.id ?? i} booking={b} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
