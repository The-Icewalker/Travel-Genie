import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTrips, getTripById } from '../api/trips.js';
import { WEATHER_ICONS, WMO_CODES } from '../api/weather.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';


// Fix Leaflet default icon path for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const DEFAULT_CENTER = [48.8566, 2.3522]; // Paris fallback
const DEFAULT_ZOOM = 13;

const DAY_COLORS = [
  '#e4572e', // Coral (Day 1)
  '#1d7874', // Sea Teal (Day 2)
  '#d97706', // Amber (Day 3)
  '#2b9348', // Moss Green (Day 4)
  '#7c3aed', // Purple (Day 5)
  '#0284c7', // Sky Blue (Day 6)
  '#ec4899', // Pink (Day 7)
];

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (/hotel|check-in|stay|hostel|resort|lodge|accommodation/.test(t)) {
    return { name: 'Hotel & Stay', emoji: '🏨' };
  }
  if (/lunch|dinner|breakfast|bistro|food|cafe|restaurant|tasting|bakery|patisserie|wine|eat|meal|brunch|bar/.test(t)) {
    return { name: 'Dining & Food', emoji: '🍜' };
  }
  if (/museum|gallery|heritage|historic|monument|palace|cathedral|church|tower|castle|eiffel|louvre/.test(t)) {
    return { name: 'Culture & Landmark', emoji: '🏛️' };
  }
  if (/park|garden|walk|promenade|hike|viewpoint|scenic|waterfall|nature|river|cruise|lake|alp/.test(t)) {
    return { name: 'Scenery & Nature', emoji: '🌳' };
  }
  if (/shopping|market|store|boutique|souvenir|mall/.test(t)) {
    return { name: 'Shopping & Markets', emoji: '🛍️' };
  }
  return { name: 'Activity', emoji: '📍' };
}

function createPinIcon(emoji, color, isHighlight = false) {
  return L.divIcon({
    className: 'tg-custom-pin',
    html: `
      <div style="
        background: ${color};
        width: ${isHighlight ? '42px' : '36px'};
        height: ${isHighlight ? '42px' : '36px'};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        border: 2.5px solid #ffffff;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${isHighlight ? '20px' : '16px'};
          line-height: 1;
        ">${emoji}</span>
      </div>
    `,
    iconSize: isHighlight ? [42, 42] : [36, 36],
    iconAnchor: isHighlight ? [21, 42] : [18, 36],
    popupAnchor: [0, -36],
  });
}

async function geocodeCity(cityName) {
  if (!cityName) return null;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`
    );
    const data = await res.json();
    if (data.results?.length > 0) {
      const { latitude, longitude, name, country } = data.results[0];
      return { lat: latitude, lon: longitude, label: `${name}, ${country}` };
    }
  } catch {}
  return null;
}

function MapController({ center, zoom, flyTarget }) {
  const map = useMap();
  useEffect(() => {
    if (flyTarget && flyTarget.lat && flyTarget.lng) {
      map.flyTo([flyTarget.lat, flyTarget.lng], 15, { duration: 1.2 });
    } else if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 13, { duration: 1.2 });
    }
  }, [center, zoom, flyTarget, map]);
  return null;
}

export default function MapPage() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [activeTrip, setActiveTrip] = useState(null);
  const [cityCoords, setCityCoords] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  const [loadingTrip, setLoadingTrip] = useState(false);
  const [error, setError] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const markerRefs = useRef({});

  // 1. Load initial trips list
  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getTrips();
        const tripList = res.data?.results ?? res.data ?? [];
        setTrips(tripList);

        if (tripList.length > 0) {
          const firstId = tripList[0].trip_id || tripList[0].id;
          setSelectedTripId(String(firstId));
        }
      } catch {
        setError('Failed to load trips.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  // 2. Load detailed trip data whenever selectedTripId changes
  useEffect(() => {
    if (!selectedTripId) return;
    const fetchTripDetail = async () => {
      setLoadingTrip(true);
      setFlyTarget(null);
      setSelectedDayFilter('all');
      try {
        const res = await getTripById(selectedTripId);
        const tripData = res.data;
        setActiveTrip(tripData);

        // Geocode the city
        const cityName = tripData.destination_detail?.city || tripData.destination || '';
        if (cityName) {
          const coords = await geocodeCity(cityName);
          if (coords) {
            setCityCoords([coords.lat, coords.lon]);
          }
        }
      } catch {
        setError('Failed to load trip details.');
      } finally {
        setLoadingTrip(false);
      }
    };
    fetchTripDetail();
  }, [selectedTripId]);

  // Fetch live Open-Meteo atmospheric weather for the destination
  useEffect(() => {
    if (!cityCoords || !cityCoords[0] || !cityCoords[1]) {
      setWeather(null);
      return;
    }
    let active = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cityCoords[0]}&longitude=${cityCoords[1]}&current_weather=true`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.current_weather) {
          setWeather(data.current_weather);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cityCoords]);

  // 3. Compute all plotted places (attractions + itinerary activities)

  const places = useMemo(() => {
    if (!activeTrip) return [];

    const centerLat = cityCoords ? cityCoords[0] : DEFAULT_CENTER[0];
    const centerLng = cityCoords ? cityCoords[1] : DEFAULT_CENTER[1];
    const items = [];

    // A. Add Destination Attractions from DB if present
    const attractions = activeTrip.destination_detail?.attractions || [];
    attractions.forEach((att, idx) => {
      const lat = att.lat ? parseFloat(att.lat) : centerLat + 0.005 * (idx + 1);
      const lng = att.lng ? parseFloat(att.lng) : centerLng + 0.005 * (idx + 1);
      items.push({
        id: `attraction-${att.attraction_id || idx}`,
        title: att.name,
        venueName: att.name,
        categoryName: att.category || 'Major Attraction',
        emoji: '⭐',
        color: '#f59e0b', // Gold
        isAttraction: true,
        dayNumber: null,
        dayLabel: 'Key Landmark',
        cost: att.avg_cost ? parseFloat(att.avg_cost) : 0,
        time: 'Must-See Spot',
        lat,
        lng,
      });
    });

    // B. Add Itinerary Activities grouped by Day
    const days = activeTrip.days || [];
    days.forEach((day, dayIdx) => {
      const dayNum = day.day_number || dayIdx + 1;
      const color = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length];

      (day.items || []).forEach((item, itemIdx) => {
        const cat = detectCategory(item.title);

        // Prefer exact real-world coordinates from discovered attractions
        let lat = null;
        let lng = null;

        if (item.lat != null && item.lng != null && !isNaN(Number(item.lat))) {
          lat = parseFloat(item.lat);
          lng = parseFloat(item.lng);
        } else if (item.attraction_detail?.lat != null && item.attraction_detail?.lng != null) {
          lat = parseFloat(item.attraction_detail.lat);
          lng = parseFloat(item.attraction_detail.lng);
        } else if (item.attraction?.lat != null && item.attraction?.lng != null) {
          lat = parseFloat(item.attraction.lat);
          lng = parseFloat(item.attraction.lng);
        } else {
          // Check if item title matches any known attraction in this destination
          const matchedAtt = attractions.find((a) =>
            a.name && (item.title.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(item.title.toLowerCase()))
          );
          if (matchedAtt && matchedAtt.lat && matchedAtt.lng) {
            lat = parseFloat(matchedAtt.lat);
            lng = parseFloat(matchedAtt.lng);
          }
        }

        if (lat == null || lng == null) {
          // Cohesive geographic distribution per day as fallback only
          const seedAngle = (dayNum * 1.35 + itemIdx * 1.85);
          const distance = 0.009 + (((item.id || itemIdx) * 19) % 15) * 0.0011;
          lat = centerLat + Math.cos(seedAngle) * distance;
          lng = centerLng + Math.sin(seedAngle) * (distance * 1.3);
        }

        const venueName =
          item.location_name ||
          item.attraction_detail?.name ||
          (typeof item.attraction === 'object' ? item.attraction?.name : null) ||
          item.title;

        items.push({
          id: `item-${item.id || item.item_id || `${dayNum}-${itemIdx}`}`,
          itemId: item.id || item.item_id,
          title: item.title,
          venueName,
          categoryName: cat.name,
          emoji: cat.emoji,
          color: color,
          isAttraction: false,
          dayNumber: dayNum,
          dayLabel: `Day ${dayNum}`,
          date: day.date,
          time: item.time || (item.start_time ? String(item.start_time).slice(0, 5) : `Activity ${itemIdx + 1}`),
          cost: parseFloat(item.est_cost || 0),
          isInBudget: item.is_in_budget,
          lat,
          lng,
        });
      });
    });

    return items;
  }, [activeTrip, cityCoords]);

  // Filter places based on selected Day and search input
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      // Day filter
      if (selectedDayFilter === 'highlights') {
        if (!p.isAttraction) return false;
      } else if (selectedDayFilter !== 'all') {
        if (p.dayNumber !== parseInt(selectedDayFilter, 10)) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          (p.venueName && p.venueName.toLowerCase().includes(q)) ||
          p.categoryName.toLowerCase().includes(q) ||
          (p.dayLabel && p.dayLabel.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [places, selectedDayFilter, searchQuery]);

  const handleFocusPlace = (place) => {
    setSelectedPlace(place);
    setFlyTarget({ lat: place.lat, lng: place.lng, timestamp: Date.now() });
    const marker = markerRefs.current[place.id];
    if (marker) {
      marker.openPopup();
    }
  };

  const mapCenter = cityCoords || DEFAULT_CENTER;
  const destinationName = activeTrip?.destination_detail?.city || activeTrip?.destination || 'Destination';
  const countryName = activeTrip?.destination_detail?.country || '';

  const getGoogleMapsUrl = (place) => {
    if (!place) {
      return destinationName
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destinationName} attractions`)}`
        : 'https://www.google.com/maps';
    }

    const placeName = place.venueName || place.title || '';
    const city = destinationName || '';
    const query = city && !placeName.toLowerCase().includes(city.toLowerCase())
      ? `${placeName}, ${city}`
      : placeName;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="space-y-6 tg-rise">
      {/* Top Header: Title & Trip Selector */}
      <div className="flex flex-wrap items-end justify-between gap-6 pb-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="tg-label mb-2" style={{ color: 'var(--coral)' }}>
            Atlas · Interactive Itinerary Map
          </div>
          <h1 className="tg-serif text-4xl md:text-5xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
            Trip Map & Landmarks
          </h1>
          <p className="mt-2 text-sm md:text-base font-medium" style={{ color: 'var(--ink-2)' }}>
            Explore your destinations, key attractions, and daily itinerary schedule pinned on the map.
          </p>
        </div>

        {/* Trip Switcher Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="tg-label text-xs">Active Trip:</span>
            <select
              className="tg-input text-xs font-bold py-2 px-3.5 min-w-[240px] cursor-pointer"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              disabled={loading || trips.length === 0}
            >
              {trips.length === 0 ? (
                <option value="">No trips created yet</option>
              ) : (
                trips.map((t) => (
                  <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                    {t.title} {t.destination_detail?.city ? `(${t.destination_detail.city})` : ''}
                  </option>
                ))
              )}
            </select>
          </label>

          {activeTrip && (
            <Link
              to={`/trips/${selectedTripId}`}
              className="tg-btn text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-sm font-bold"
            >
              <span>🗓️</span>
              <span>Open Full Itinerary</span>
            </Link>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-xs font-bold text-[var(--mute)]">Loading Atlas…</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl text-sm font-semibold" style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
          {error}
        </div>
      )}

      {!loading && !error && trips.length === 0 && (
        <div className="tg-card tg-grain py-20 text-center">
          <div
            className="tg-float inline-flex h-20 w-20 items-center justify-center rounded-full mb-5 text-4xl shadow-md"
            style={{ background: 'var(--coral-soft)' }}
          >
            📍
          </div>
          <p className="tg-serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>No trips created yet</p>
          <p className="text-sm mt-2 text-[var(--mute)]">Create your first trip with our AI Concierge to see your destinations plotted on the map.</p>
          <Link
            to="/trips/new"
            className="mt-6 inline-block tg-btn text-xs py-2.5 px-5 font-bold"
          >
            Plan a Trip to Get Started →
          </Link>
        </div>
      )}

      {!loading && !error && trips.length > 0 && activeTrip && (
        <div className="space-y-4">
          {/* Destination Banner & Filter Bar */}
          <div
            className="tg-card p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm"
            style={{ background: 'var(--sand)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">📍</span>
              <div className="min-w-0">
                <h3 className="font-bold text-base truncate" style={{ color: 'var(--ink)' }}>
                  {destinationName}{countryName ? `, ${countryName}` : ''}
                </h3>
                <p className="text-xs font-semibold text-[var(--sea)]">
                  {places.length} Places Plotted · {activeTrip.days?.length || 0} Scheduled Days
                </p>
              </div>

              {weather && (
                <Link
                  to={`/weather?tripId=${activeTrip.trip_id || activeTrip.id}`}
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition hover:border-[var(--coral)] bg-white shadow-xs ml-2"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                  title="View detailed atmospheric weather forecast"
                >
                  <span className="text-base">{WEATHER_ICONS[weather.weathercode] || '⛅'}</span>
                  <span>{Math.round(weather.temperature)}°C</span>
                  <span className="text-[var(--mute)]">•</span>
                  <span className="text-[var(--sea)]">{WMO_CODES[weather.weathercode] || 'Clear'}</span>
                  <span className="text-[10px] text-[var(--mute)] font-normal ml-0.5">Atmosphere ↗</span>
                </Link>
              )}
            </div>


            {/* Day Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className="text-xs py-1 px-3 rounded-full font-bold transition-all cursor-pointer"
                style={
                  selectedDayFilter === 'all'
                    ? { background: 'var(--ink)', color: '#ffffff' }
                    : { background: 'var(--paper)', color: 'var(--ink-2)', border: '1px solid var(--line)' }
                }
              >
                All Places ({places.length})
              </button>

              {(activeTrip.days || []).map((d, i) => {
                const count = places.filter((p) => p.dayNumber === (d.day_number || i + 1)).length;
                const color = DAY_COLORS[i % DAY_COLORS.length];
                const isSelected = selectedDayFilter === String(d.day_number || i + 1);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDayFilter(String(d.day_number || i + 1))}
                    className="text-xs py-1 px-3 rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    style={
                      isSelected
                        ? { background: color, color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
                        : { background: 'var(--paper)', color: 'var(--ink-2)', border: '1px solid var(--line)' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: isSelected ? '#ffffff' : color }} />
                    <span>Day {d.day_number || i + 1} ({count})</span>
                  </button>
                );
              })}

              {places.some((p) => p.isAttraction) && (
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('highlights')}
                  className="text-xs py-1 px-3 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1"
                  style={
                    selectedDayFilter === 'highlights'
                      ? { background: '#f59e0b', color: '#ffffff' }
                      : { background: 'var(--paper)', color: 'var(--ink-2)', border: '1px solid var(--line)' }
                  }
                >
                  <span>⭐</span>
                  <span>Highlights ({places.filter((p) => p.isAttraction).length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Grid: Interactive Leaflet Map (Left) + Places List (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Map Container */}
            <div className="lg:col-span-2 tg-card p-0 overflow-hidden shadow-lg border relative" style={{ borderColor: 'var(--line)' }}>
              {loadingTrip && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-xs">
                  <LoadingSpinner size="md" />
                </div>
              )}

              <MapContainer
                center={mapCenter}
                zoom={DEFAULT_ZOOM}
                style={{ height: '560px', width: '100%' }}
                scrollWheelZoom
              >
                <MapController center={mapCenter} zoom={DEFAULT_ZOOM} flyTarget={flyTarget} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {filteredPlaces.map((place) => {
                  const icon = createPinIcon(place.emoji, place.color, place.isAttraction);
                  return (
                    <Marker
                      key={place.id}
                      position={[place.lat, place.lng]}
                      icon={icon}
                      ref={(ref) => {
                        if (ref) markerRefs.current[place.id] = ref;
                      }}
                      eventHandlers={{
                        click: () => setSelectedPlace(place),
                      }}
                    >
                      <Popup>
                        <div className="p-1 space-y-2 text-xs" style={{ minWidth: '200px' }}>
                          <div className="flex items-center justify-between gap-2 border-b pb-1.5" style={{ borderColor: '#e2e8f0' }}>
                            <span
                              className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full text-white"
                              style={{ background: place.color }}
                            >
                              {place.dayLabel}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-bold">
                              {place.time}
                            </span>
                          </div>

                          <div>
                            <p className="font-bold text-sm text-slate-900 leading-snug">
                              {place.title}
                            </p>
                            {place.venueName && place.venueName !== place.title && (
                              <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                                📍 {place.venueName}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {place.categoryName}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
                            <span className="text-slate-800">
                              {place.cost > 0 ? `$${place.cost.toFixed(2)}` : 'Included / Free'}
                            </span>
                            {place.isInBudget && (
                              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                ✓ In Budget
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t space-y-1.5" style={{ borderColor: '#e2e8f0' }}>
                            <a
                              href={getGoogleMapsUrl(place)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
                              style={{ textDecoration: 'none' }}
                            >
                              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                              </svg>
                              <span>Open in Google Maps ↗</span>
                            </a>
                            <Link
                              to={`/trips/${selectedTripId}`}
                              className="text-[11px] font-bold text-amber-700 hover:underline block text-center pt-0.5"
                            >
                              View in Trip Itinerary →
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Sidebar: Scrollable Places Directory */}
            <div className="tg-card p-5 space-y-4 shadow-md flex flex-col" style={{ height: '560px' }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                <div>
                  <h3 className="tg-serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                    Places on this Trip
                  </h3>
                  <span className="text-xs text-[var(--mute)] font-medium">
                    {filteredPlaces.length} locations matching view
                  </span>
                </div>
              </div>

              {/* Search bar inside list */}
              <div>
                <input
                  type="text"
                  placeholder="Filter places or activities…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tg-input text-xs w-full py-2 px-3"
                />
              </div>

              {/* Scrollable list of cards */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredPlaces.length === 0 ? (
                  <p className="text-xs text-[var(--mute)] py-8 text-center">
                    No places match this filter.
                  </p>
                ) : (
                  filteredPlaces.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => handleFocusPlace(place)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer hover:border-[var(--ink)] hover:shadow-sm ${
                        selectedPlace?.id === place.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                      }`}
                      style={{
                        background: 'var(--paper)',
                        borderColor: selectedPlace?.id === place.id ? '#3b82f6' : 'var(--line)',
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 text-white shadow-xs"
                          style={{ background: place.color }}
                        >
                          {place.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-xs font-bold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                              {place.title}
                            </p>
                            <a
                              href={getGoogleMapsUrl(place)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open this location in Google Maps"
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors"
                            >
                              <span>Maps</span>
                              <span>↗</span>
                            </a>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--mute)] font-semibold">
                            <span>{place.dayLabel}</span>
                            <span>•</span>
                            <span>{place.time}</span>
                            {place.cost > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-[var(--ink)]">${place.cost.toFixed(2)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer CTA */}
              <div className="pt-2 border-t text-center" style={{ borderColor: 'var(--line)' }}>
                <a
                  href={getGoogleMapsUrl(selectedPlace)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1.5 py-1 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>
                    {selectedPlace
                      ? `Open "${selectedPlace.title.length > 22 ? selectedPlace.title.slice(0, 22) + '…' : selectedPlace.title}" in Google Maps`
                      : `Open ${destinationName || 'Destination'} in Google Maps`}
                  </span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
