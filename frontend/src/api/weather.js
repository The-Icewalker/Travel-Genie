import axios from 'axios';
import axiosInstance from './axios.js';

export const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog & low mist',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain showers',
  63: 'Moderate rain',
  65: 'Heavy continuous rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snow blizzard',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent cloudburst showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Severe thunderstorm with heavy hail',
};

export const WEATHER_ICONS = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌨️',
  57: '🌨️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🧊',
  67: '🧊',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '❄️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  85: '🌨️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '🌩️',
};

/**
 * Returns tailored travel & packing suggestions based on temperature, rain, wind, and WMO code.
 */
export function getWeatherAdvisory({ temp, code, windSpeed, rainProb, humidity }) {
  const tips = [];

  // Precipitation advice
  if (code >= 95) {
    tips.push({
      icon: '⚡',
      badge: 'Severe Alert',
      color: 'var(--coral)',
      text: 'Thunderstorms expected. Schedule indoor museum tours or culinary dining.',
    });
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (rainProb && rainProb > 50)) {
    tips.push({
      icon: '☔',
      badge: 'Rain Advisory',
      color: 'var(--sea)',
      text: 'Pack an umbrella and water-resistant footwear for city explorations.',
    });
  } else if (code >= 71 && code <= 86) {
    tips.push({
      icon: '❄️',
      badge: 'Snow Alert',
      color: 'var(--sea)',
      text: 'Sub-zero snow conditions. Thermal base layers, gloves, and insulated boots required.',
    });
  }

  // Thermal advice
  if (temp <= 5) {
    tips.push({
      icon: '🧣',
      badge: 'Chilly Climate',
      color: 'var(--sea)',
      text: 'Heavy overcoat, wool scarves, and heat-trapping outerwear strongly recommended.',
    });
  } else if (temp <= 15) {
    tips.push({
      icon: '🧥',
      badge: 'Brisk Air',
      color: 'var(--sun)',
      text: 'Pleasant brisk weather. A light trench coat, windbreaker, or knit sweater is ideal.',
    });
  } else if (temp >= 28) {
    tips.push({
      icon: '🕶️',
      badge: 'High Heat & UV',
      color: 'var(--coral)',
      text: 'Sun-drenched conditions. Hydrate consistently, apply SPF 50+, and pack breathable linen clothing.',
    });
  } else {
    tips.push({
      icon: '🌿',
      badge: 'Prime Walking Weather',
      color: 'var(--moss)',
      text: 'Comfortable temperate climate. Perfect for walking tours and outdoor architectural sight-seeing.',
    });
  }

  // Wind advice
  if (windSpeed >= 35) {
    tips.push({
      icon: '💨',
      badge: 'High Gusts',
      color: 'var(--coral)',
      text: `Gusty winds up to ${Math.round(windSpeed)} km/h. Secure loose hats and gear for scenic viewpoints.`,
    });
  }

  return tips;
}

/**
 * Geocodes city or destination name via Open-Meteo Geocoding API.
 */
export async function geocodeCity(cityName) {
  if (!cityName || !cityName.trim()) return null;
  // Clean up e.g. "Kyoto, Japan" -> search "Kyoto"
  const query = cityName.split(',')[0].trim();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await axios.get(url);
  const results = res.data?.results;
  if (!results || results.length === 0) return null;
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.name,
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    admin1: r.admin1,
  }));
}

/**
 * Fetches current + 7-day daily + 24-hr hourly atmospheric telemetry from Open-Meteo.
 */
export async function fetchOpenMeteoForecast(lat, lon, timezone = 'auto') {
  if (!lat || !lon) return null;
  const url = 'https://api.open-meteo.com/v1/forecast';
  const { data } = await axios.get(url, {
    params: {
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation_probability',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: timezone || 'auto',
      wind_speed_unit: 'kmh',
    },
  });
  return data;
}

/**
 * Calls backend proxy for trip weather (which itself queries Open-Meteo).
 */
export async function getTripWeatherBackend(tripId) {
  return axiosInstance.get(`/trips/${tripId}/weather/`);
}
