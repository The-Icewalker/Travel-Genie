import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner.jsx';
import {
  WMO_CODES,
  WEATHER_ICONS,
  geocodeCity,
  fetchOpenMeteoForecast,
} from '../api/weather.js';

export default function WeatherWidget({ lat, lon, city, country, tripId }) {
  const [coords, setCoords] = useState(lat && lon ? { lat, lon } : null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Resolve coordinates if missing
  useEffect(() => {
    if (lat && lon) {
      setCoords({ lat: Number(lat), lon: Number(lon) });
      return;
    }

    if (!city) {
      setLoading(false);
      return;
    }

    let active = true;
    geocodeCity(city)
      .then((results) => {
        if (!active) return;
        if (results && results.length > 0) {
          setCoords({ lat: results[0].lat, lon: results[0].lon });
        } else {
          setError('Location not found');
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError('Geocoding offline');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [lat, lon, city]);

  // 2. Fetch atmospheric telemetry
  useEffect(() => {
    if (!coords) return;
    let active = true;
    setLoading(true);
    setError(null);

    fetchOpenMeteoForecast(coords.lat, coords.lon)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setError('Unable to sync meteorological telemetry');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [coords]);

  const current = data?.current;
  const daily = data?.daily;
  const currentCode = current?.weather_code ?? 0;
  const cityName = city || 'Destination';

  return (
    <div className="tg-card p-6 shadow-sm overflow-hidden relative">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⛅</span>
          <div>
            <div className="tg-label" style={{ color: 'var(--sea)' }}>
              Atmospheric Telemetry
            </div>
            <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              {cityName}{country ? `, ${country}` : ''}
            </div>
          </div>
        </div>

        <Link
          to={tripId ? `/weather?tripId=${tripId}` : `/weather?city=${encodeURIComponent(cityName)}`}
          className="text-xs font-bold px-3 py-1.5 rounded-full border bg-white hover:border-[var(--coral)] hover:text-[var(--coral)] transition flex items-center gap-1.5 shadow-sm"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          <span>Live Horizon</span>
          <span>→</span>
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-6 text-sm text-[var(--mute)]">
          <LoadingSpinner size="sm" />
          <span>Synchronizing Open-Meteo atmospheric telemetry…</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs font-semibold py-3 text-[var(--coral)]">{error}</p>
      )}

      {current && !loading && (
        <div className="space-y-5">
          {/* Main readout */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-5xl tg-float">
                {WEATHER_ICONS[currentCode] || '🌡️'}
              </span>
              <div>
                <div className="tg-serif text-4xl font-bold leading-none" style={{ color: 'var(--ink)' }}>
                  {Math.round(current.temperature_2m)}°C
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: 'var(--sea)' }}>
                  {WMO_CODES[currentCode] || 'Clear Skies'}
                </div>
                <div className="text-xs text-[var(--mute)] font-medium mt-0.5">
                  Feels like {Math.round(current.apparent_temperature)}°C
                </div>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="flex items-center gap-4 sm:gap-6 text-xs border-l pl-4 sm:pl-6" style={{ borderColor: 'var(--line)' }}>
              <div>
                <div className="tg-label">Humidity</div>
                <div className="font-bold text-sm mt-0.5 text-[var(--ink)]">
                  {current.relative_humidity_2m}%
                </div>
              </div>
              <div>
                <div className="tg-label">Wind Velocity</div>
                <div className="font-bold text-sm mt-0.5 text-[var(--ink)]">
                  {Math.round(current.wind_speed_10m)} km/h
                </div>
              </div>
              {daily?.precipitation_probability_max?.[0] != null && (
                <div>
                  <div className="tg-label">Rain Chance</div>
                  <div className="font-bold text-sm mt-0.5 text-[var(--sea)]">
                    {daily.precipitation_probability_max[0]}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3-Day Mini Horizon Strip */}
          {daily?.time && daily.time.length >= 3 && (
            <div className="pt-3 border-t border-dashed" style={{ borderColor: 'var(--line)' }}>
              <div className="text-[11px] font-bold text-[var(--mute)] uppercase tracking-wider mb-2">
                3-Day Meteorological Horizon
              </div>
              <div className="grid grid-cols-3 gap-2">
                {daily.time.slice(0, 3).map((dayStr, idx) => {
                  const d = new Date(dayStr);
                  const label = idx === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
                  const c = daily.weather_code[idx];
                  const max = Math.round(daily.temperature_2m_max[idx]);
                  const min = Math.round(daily.temperature_2m_min[idx]);

                  return (
                    <div
                      key={dayStr}
                      className="p-2.5 rounded-xl border text-center bg-white shadow-xs"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <div className="text-[11px] font-bold text-[var(--ink)]">{label}</div>
                      <div className="text-2xl my-1">{WEATHER_ICONS[c] || '🌤️'}</div>
                      <div className="text-xs font-bold text-[var(--ink)]">
                        <span style={{ color: 'var(--coral)' }}>{max}°</span> / <span style={{ color: 'var(--sea)' }}>{min}°</span>
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
