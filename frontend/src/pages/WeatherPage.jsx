import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getTrips } from '../api/trips.js';
import {
  WMO_CODES,
  WEATHER_ICONS,
  getWeatherAdvisory,
  geocodeCity,
  fetchOpenMeteoForecast,
} from '../api/weather.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const PRESET_DESTINATIONS = [
  { city: 'Kyoto', country: 'Japan', icon: '⛩️', lat: 35.0211, lon: 135.7538 },
  { city: 'Tokyo', country: 'Japan', icon: '🗼', lat: 35.6895, lon: 139.6917 },
  { city: 'Paris', country: 'France', icon: '🥐', lat: 48.8566, lon: 2.3522 },
  { city: 'Zermatt', country: 'Switzerland', icon: '🏔️', lat: 45.9765, lon: 7.7491 },
  { city: 'Positano', country: 'Italy', icon: '🍋', lat: 40.6281, lon: 14.4850 },
  { city: 'Reykjavik', country: 'Iceland', icon: '🌋', lat: 64.1466, lon: -21.9426 },
  { city: 'Bali', country: 'Indonesia', icon: '🌴', lat: -8.3405, lon: 115.0920 },
  { city: 'New York', country: 'USA', icon: '🗽', lat: 40.7128, lon: -74.0060 },
];

function getWindCompass(deg) {
  if (deg == null) return '';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

export default function WeatherPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  // Search & Location
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Active target location
  const [location, setLocation] = useState({
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0211,
    lon: 135.7538,
  });

  // Weather telemetry state
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Fetch user trips
  useEffect(() => {
    getTrips()
      .then((res) => {
        const list = res.data?.results || res.data || [];
        setTrips(list);

        // Check if query param specifies tripId
        const tripIdParam = searchParams.get('tripId');
        const cityParam = searchParams.get('city');

        if (tripIdParam) {
          const match = list.find((t) => String(t.trip_id || t.id) === String(tripIdParam));
          if (match) {
            handleSelectTrip(match);
            return;
          }
        }

        if (cityParam) {
          handleSearchCity(cityParam);
        } else if (list.length > 0) {
          // Default to user's first planned trip!
          handleSelectTrip(list[0]);
        } else {
          // Default to Kyoto preset
          handleSelectPreset(PRESET_DESTINATIONS[0]);
        }
      })
      .catch(() => {
        handleSelectPreset(PRESET_DESTINATIONS[0]);
      });
  }, []);

  // Fetch telemetry for specific coordinates
  const loadWeather = async (lat, lon, city, country) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOpenMeteoForecast(lat, lon);
      setWeatherData(data);
      setLocation({ city, country, lat, lon });
    } catch (err) {
      console.error(err);
      setError('Unable to retrieve atmospheric weather data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Select a planned trip
  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip);
    setActivePreset(null);
    setSearchResults([]);
    setSearchQuery('');

    const city = trip.destination_detail?.city || (typeof trip.destination === 'string' ? trip.destination.split(',')[0].trim() : trip.title);
    const country = trip.destination_detail?.country || '';

    // Check if attractions have lat/lng
    const attr = trip.destination_detail?.attractions?.find((a) => a.lat && a.lng);
    if (attr) {
      loadWeather(Number(attr.lat), Number(attr.lng), city, country);
      return;
    }

    // Geocode city
    try {
      const geo = await geocodeCity(city);
      if (geo && geo.length > 0) {
        loadWeather(geo[0].lat, geo[0].lon, geo[0].city, geo[0].country || country);
      } else {
        loadWeather(35.0211, 135.7538, city, country);
      }
    } catch {
      loadWeather(35.0211, 135.7538, city, country);
    }
  };

  // Select a global preset
  const handleSelectPreset = (p) => {
    setSelectedTrip(null);
    setActivePreset(p.city);
    setSearchResults([]);
    setSearchQuery('');
    loadWeather(p.lat, p.lon, p.city, p.country);
  };

  // Handle custom search
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleSearchCity(searchQuery);
  };

  const handleSearchCity = async (name) => {
    setSearching(true);
    setSelectedTrip(null);
    setActivePreset(null);
    setError('');
    try {
      const results = await geocodeCity(name);
      if (!results || results.length === 0) {
        setError(`No coordinates discovered for "${name}". Please check the spelling.`);
        setSearchResults([]);
      } else if (results.length === 1) {
        setSearchResults([]);
        loadWeather(results[0].lat, results[0].lon, results[0].city, results[0].country);
      } else {
        setSearchResults(results);
      }
    } catch {
      setError('Geocoding service unavailable.');
    } finally {
      setSearching(false);
    }
  };

  // Extract current telemetry
  const current = weatherData?.current;
  const daily = weatherData?.daily;
  const hourly = weatherData?.hourly;

  const currentCode = current?.weather_code ?? 0;
  const currentTemp = current?.temperature_2m != null ? Math.round(current.temperature_2m) : '--';
  const currentApparent = current?.apparent_temperature != null ? Math.round(current.apparent_temperature) : '--';
  const currentWind = current?.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : '--';
  const currentWindDir = current?.wind_direction_10m;
  const currentHumidity = current?.relative_humidity_2m;
  const currentPressure = current?.surface_pressure != null ? Math.round(current.surface_pressure) : '--';
  const currentPrecip = current?.precipitation ?? 0;

  // Travel advisories
  const advisories = useMemo(() => {
    if (!current) return [];
    return getWeatherAdvisory({
      temp: current.temperature_2m,
      code: current.weather_code,
      windSpeed: current.wind_speed_10m,
      humidity: current.relative_humidity_2m,
      rainProb: daily?.precipitation_probability_max?.[0],
    });
  }, [current, daily]);

  // Hourly next 24 entries
  const next24Hours = useMemo(() => {
    if (!hourly?.time) return [];
    const now = new Date();
    const list = [];
    for (let i = 0; i < hourly.time.length && list.length < 24; i++) {
      const d = new Date(hourly.time[i]);
      if (d >= now || i >= 12) {
        list.push({
          time: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          temp: Math.round(hourly.temperature_2m[i]),
          code: hourly.weather_code[i],
          pop: hourly.precipitation_probability?.[i] ?? 0,
        });
      }
    }
    return list;
  }, [hourly]);

  return (
    <div className="space-y-8 pb-12 tg-rise">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="tg-label flex items-center gap-2" style={{ color: 'var(--coral)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Atmospheric Meteorological Intelligence
          </div>
          <h1 className="tg-serif text-4xl md:text-5xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
            Weather Concierge
          </h1>
          <p className="mt-1 text-sm md:text-base text-[var(--ink-2)] max-w-2xl">
            Live atmospheric telemetry queried directly from <strong>Open-Meteo</strong> high-resolution weather models with daily horizon forecasts and smart packing advisories.
          </p>
        </div>

        {/* Status Pill */}
        <div
          className="self-start md:self-auto px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border shadow-sm"
          style={{ background: 'var(--paper)', borderColor: 'var(--line)', color: 'var(--sea)' }}
        >
          <span className="text-base">📡</span>
          <span>Open-Meteo Telemetry: Online</span>
        </div>
      </div>

      {/* Unified Location Control Center */}
      <div className="tg-card p-6 shadow-sm space-y-6">
        {/* Active Selection Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="tg-label flex items-center gap-1.5" style={{ color: 'var(--sea)' }}>
              <span>📍</span> Active Telemetry Location
            </div>
            <div className="text-xl md:text-2xl font-bold flex flex-wrap items-center gap-2.5 mt-0.5" style={{ color: 'var(--ink)' }}>
              <span>{location.city}{location.country ? `, ${location.country}` : ''}</span>
              {selectedTrip ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-[var(--coral)] text-white shadow-xs">
                  From Planned Trip
                </span>
              ) : activePreset ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-[var(--sea-soft)] text-[var(--sea)] border border-[var(--sea)]/30">
                  Global Preset
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                  Custom Search
                </span>
              )}
            </div>
          </div>

          {selectedTrip && (
            <Link
              to={`/trips/${selectedTrip.trip_id || selectedTrip.id}`}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-white hover:border-[var(--coral)] hover:text-[var(--coral)] transition flex items-center gap-1.5 shadow-xs"
              style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              <span>View {selectedTrip.title} Dossier</span>
              <span>→</span>
            </Link>
          )}
        </div>

        {/* 1. SELECT FROM PLANNED TRIPS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              <span>🧳</span> Select from Your Planned Trips ({trips.length})
            </label>
            {trips.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--mute)]">
                Syncs itinerary coordinates with live telemetry
              </span>
            )}
          </div>

          {trips.length > 0 ? (
            <div className="space-y-3">
              {/* Dropdown for quick selection */}
              <div>
                <select
                  value={selectedTrip ? String(selectedTrip.trip_id || selectedTrip.id) : ''}
                  onChange={(e) => {
                    const match = trips.find((t) => String(t.trip_id || t.id) === e.target.value);
                    if (match) handleSelectTrip(match);
                  }}
                  className="tg-input py-2.5 px-3 text-sm font-semibold cursor-pointer w-full"
                  style={{ background: 'var(--sand)' }}
                >
                  <option value="" disabled>-- Or select a planned trip from dropdown --</option>
                  {trips.map((t) => {
                    const tripId = t.trip_id || t.id;
                    const cityName = t.destination_detail?.city || (typeof t.destination === 'string' ? t.destination.split(',')[0].trim() : t.title);
                    const countryName = t.destination_detail?.country || '';
                    return (
                      <option key={tripId} value={String(tripId)}>
                        {t.title} — {cityName}{countryName ? `, ${countryName}` : ''} ({t.start_date} → {t.end_date})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Visual Interactive Trip Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {trips.map((t) => {
                  const tripId = t.trip_id || t.id;
                  const isSelected = selectedTrip && (selectedTrip.trip_id || selectedTrip.id) === tripId;
                  const cityName = t.destination_detail?.city || (typeof t.destination === 'string' ? t.destination.split(',')[0].trim() : t.title);
                  const countryName = t.destination_detail?.country || '';

                  return (
                    <button
                      key={tripId}
                      type="button"
                      onClick={() => handleSelectTrip(t)}
                      className={`p-3.5 rounded-2xl text-left border transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'ring-2 ring-[var(--coral)] shadow-md'
                          : 'hover:border-[var(--sea)] hover:shadow-sm'
                      }`}
                      style={{
                        borderColor: isSelected ? 'var(--coral)' : 'var(--line)',
                        background: isSelected ? 'var(--ink)' : 'white',
                        color: isSelected ? 'white' : 'var(--ink)',
                      }}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="text-2xl shrink-0">📍</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs leading-snug truncate">
                            {t.title}
                          </div>
                          <div className={`text-[11px] font-semibold truncate ${isSelected ? 'text-gray-200' : 'text-[var(--sea)]'}`}>
                            {cityName}{countryName ? `, ${countryName}` : ''}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-300' : 'text-[var(--mute)]'}`}>
                            📅 {t.start_date}
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--coral)] text-white shrink-0">
                          Active ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[var(--mute)] shrink-0">
                          Select ↗
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border text-center text-xs text-[var(--mute)] bg-white" style={{ borderColor: 'var(--line)' }}>
              No planned journeys discovered yet. <Link to="/trips/new" className="text-[var(--coral)] font-bold underline">Plan a trip</Link> to automatically load its weather.
            </div>
          )}
        </div>

        {/* 2. GLOBAL EXPLORATION PRESETS */}
        <div className="pt-4 border-t space-y-2.5" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
            <span>🌍</span> Global Exploration Presets
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_DESTINATIONS.map((p) => {
              const isPresetActive = !selectedTrip && location.city.toLowerCase() === p.city.toLowerCase();
              return (
                <button
                  key={p.city}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                    isPresetActive
                      ? 'shadow-sm'
                      : 'hover:border-[var(--coral)]'
                  }`}
                  style={{
                    borderColor: isPresetActive ? 'var(--sea)' : 'var(--line)',
                    background: isPresetActive ? 'var(--sea)' : 'white',
                    color: isPresetActive ? 'white' : 'var(--ink)',
                  }}
                >
                  <span className="text-base">{p.icon}</span>
                  <span>{p.city}</span>
                  <span className={`text-[10px] font-normal ${isPresetActive ? 'text-white/80' : 'text-[var(--mute)]'}`}>
                    {p.country}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. GLOBAL CUSTOM CITY SEARCH */}
        <div className="pt-4 border-t space-y-2.5" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
            <span>🔍</span> Search Any Global Destination
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              {/* Perfectly centered SVG Search Icon */}
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--mute)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any global city (e.g. Venice, Barcelona, Sydney, Cairo)..."
                className="tg-input pl-10 pr-8 py-2.5 text-sm w-full"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-[var(--mute)] hover:text-[var(--ink)]"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={searching}
              className="tg-btn px-6 py-2.5 text-sm justify-center font-bold shrink-0"
            >
              {searching ? <LoadingSpinner size="sm" /> : 'Inspect Atmosphere →'}
            </button>
          </form>

          {/* Search Results Dropdown/List */}
          {searchResults.length > 0 && (
            <div className="p-3 rounded-2xl border space-y-1.5" style={{ background: 'var(--sand)', borderColor: 'var(--line)' }}>
              <div className="text-xs font-bold text-[var(--mute)] px-2 pb-1">
                Multiple locations matched. Choose destination:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedTrip(null);
                      setActivePreset(null);
                      setSearchResults([]);
                      loadWeather(r.lat, r.lon, r.city, r.country);
                    }}
                    className="p-2.5 rounded-xl text-left border bg-white hover:border-[var(--coral)] transition flex items-center justify-between"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="font-bold text-xs text-[var(--ink)]">
                      {r.city}, {r.admin1 ? `${r.admin1}, ` : ''}{r.country}
                    </span>
                    <span className="text-[10px] text-[var(--sea)] font-semibold">Select ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm font-semibold text-[var(--mute)]">
            Consulting Open-Meteo atmospheric telemetry for {location.city}…
          </span>
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

      {/* Main Meteorological Dashboard */}
      {!loading && weatherData && (
        <div className="space-y-8">
          {/* Current Atmosphere Hero Showcase */}
          <div className="tg-card p-8 shadow-xl overflow-hidden relative">
            {/* Background subtle atmosphere icon */}
            <div
              className="absolute -right-8 -bottom-10 text-[180px] pointer-events-none select-none opacity-10"
              style={{ color: 'var(--ink)' }}
            >
              {WEATHER_ICONS[currentCode] || '☀️'}
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              {/* Left Column: Destination & Large Temp */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📍</span>
                  <span className="tg-label" style={{ color: 'var(--sea)' }}>
                    {location.country ? `${location.city}, ${location.country}` : location.city}
                  </span>
                  <span className="text-xs font-mono font-bold text-[var(--mute)]">
                    ({location.lat?.toFixed(2)}°, {location.lon?.toFixed(2)}°)
                  </span>
                </div>

                <div className="flex items-center gap-6 mt-4">
                  <span className="text-6xl md:text-7xl tg-float">
                    {WEATHER_ICONS[currentCode] || '🌡️'}
                  </span>
                  <div>
                    <div className="tg-serif text-5xl md:text-6xl font-bold leading-none" style={{ color: 'var(--ink)' }}>
                      {currentTemp}°C
                    </div>
                    <div className="text-base font-bold mt-2" style={{ color: 'var(--sea)' }}>
                      {WMO_CODES[currentCode] || 'Clear Conditions'}
                    </div>
                    <div className="text-xs font-semibold text-[var(--mute)] mt-1">
                      Feels like {currentApparent}°C • Today’s range: {Math.round(daily?.temperature_2m_min?.[0] ?? currentTemp)}°C → {Math.round(daily?.temperature_2m_max?.[0] ?? currentTemp)}°C
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: 4-Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
                {/* Humidity */}
                <div className="p-4 rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mute)]">
                    <span>💧</span>
                    <span>Humidity</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-[var(--ink)]">
                    {currentHumidity != null ? `${currentHumidity}%` : '--'}
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--mute)] mt-0.5">
                    {currentHumidity > 70 ? 'High moisture' : currentHumidity < 30 ? 'Dry air' : 'Optimal comfort'}
                  </div>
                </div>

                {/* Wind */}
                <div className="p-4 rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mute)]">
                    <span>💨</span>
                    <span>Wind Velocity</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-[var(--ink)]">
                    {currentWind} <span className="text-xs font-normal">km/h</span>
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--mute)] mt-0.5">
                    {getWindCompass(currentWindDir)} ({currentWindDir}°)
                  </div>
                </div>

                {/* Precipitation */}
                <div className="p-4 rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mute)]">
                    <span>☔</span>
                    <span>Precipitation</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-[var(--ink)]">
                    {currentPrecip} <span className="text-xs font-normal">mm</span>
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--mute)] mt-0.5">
                    Rain Chance: {daily?.precipitation_probability_max?.[0] ?? 0}%
                  </div>
                </div>

                {/* Pressure */}
                <div className="p-4 rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mute)]">
                    <span>⏱️</span>
                    <span>Barometric</span>
                  </div>
                  <div className="text-2xl font-bold mt-1 text-[var(--ink)]">
                    {currentPressure} <span className="text-xs font-normal">hPa</span>
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--mute)] mt-0.5">
                    {currentPressure > 1013 ? 'High pressure' : 'Standard baro'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Travel & Packing Advisory Section */}
          {advisories.length > 0 && (
            <div className="tg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎒</span>
                  <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    Intelligent Atmospheric Travel Advisory
                  </h3>
                </div>
                <span className="text-xs font-semibold text-[var(--mute)]">
                  Derived from real-time Open-Meteo telemetry
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {advisories.map((adv, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border bg-white shadow-sm flex items-start gap-3.5"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="text-3xl shrink-0 p-2 rounded-xl" style={{ background: 'var(--sand)' }}>
                      {adv.icon}
                    </span>
                    <div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5"
                        style={{ color: adv.color, background: 'var(--sand)' }}
                      >
                        {adv.badge}
                      </span>
                      <p className="text-xs font-medium text-[var(--ink-2)] leading-relaxed">
                        {adv.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 24-Hour Hourly Timeline Strip */}
          {next24Hours.length > 0 && (
            <div className="tg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🕒</span>
                  <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    Today’s Hourly Trajectory
                  </h3>
                </div>
                <span className="text-xs font-semibold text-[var(--mute)]">Next 24 Hours</span>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none">
                {next24Hours.map((h, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl border text-center shrink-0 w-24 bg-white shadow-sm flex flex-col items-center justify-between"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="text-[11px] font-bold text-[var(--mute)] uppercase tracking-wider">
                      {h.time}
                    </span>
                    <span className="text-2xl my-2">{WEATHER_ICONS[h.code] || '🌤️'}</span>
                    <span className="font-bold text-base text-[var(--ink)]">{h.temp}°C</span>
                    {h.pop > 15 ? (
                      <span className="text-[10px] font-bold text-[var(--sea)] mt-1">
                        💧 {h.pop}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[var(--mute)] mt-1">Dry</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7-Day Horizon Daily Forecast */}
          {daily?.time && (
            <div className="tg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                    7-Day Meteorological Horizon
                  </h3>
                </div>
                <span className="text-xs font-semibold text-[var(--mute)]">Extended Daily Forecast</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
                {daily.time.map((dayStr, i) => {
                  const d = new Date(dayStr);
                  const isToday = i === 0;
                  const dayName = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateNum = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const code = daily.weather_code[i];
                  const maxTemp = Math.round(daily.temperature_2m_max[i]);
                  const minTemp = Math.round(daily.temperature_2m_min[i]);
                  const rainChance = daily.precipitation_probability_max?.[i] ?? 0;
                  const rainSum = daily.precipitation_sum?.[i] ?? 0;

                  return (
                    <div
                      key={dayStr}
                      className={`p-4 rounded-2xl border text-center flex flex-col justify-between transition hover:-translate-y-1 ${
                        isToday ? 'shadow-md border-[var(--coral)]' : 'shadow-sm'
                      }`}
                      style={{
                        background: isToday ? 'var(--paper)' : 'white',
                        borderColor: isToday ? 'var(--coral)' : 'var(--line)',
                      }}
                    >
                      <div>
                        <div className="font-bold text-sm text-[var(--ink)]">{dayName}</div>
                        <div className="text-[10px] font-semibold text-[var(--mute)]">{dateNum}</div>

                        <div className="text-3xl my-3">{WEATHER_ICONS[code] || '🌤️'}</div>
                        <div className="text-[11px] font-semibold text-[var(--ink-2)] line-clamp-1">
                          {WMO_CODES[code] || 'Clear'}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-dashed" style={{ borderColor: 'var(--line)' }}>
                        <div className="flex items-center justify-center gap-2 text-sm font-bold">
                          <span style={{ color: 'var(--coral)' }}>{maxTemp}°</span>
                          <span className="text-[var(--mute)]">/</span>
                          <span style={{ color: 'var(--sea)' }}>{minTemp}°</span>
                        </div>

                        {rainChance > 20 && (
                          <div className="text-[10px] font-bold text-[var(--sea)] mt-1.5 flex items-center justify-center gap-1">
                            <span>☔</span>
                            <span>{rainChance}%</span>
                            {rainSum > 0 && <span className="text-[var(--mute)]">({rainSum}mm)</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
