import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { WeatherData } from '../types';

interface VenueCoords {
  lat: number;
  lon: number;
  city: string;
}

// Fixed coordinates for all 16 WC 2026 stadiums: 11 USA, 3 Mexico, 2 Canada
const VENUE_COORDS: Record<string, VenueCoords> = {
  'MetLife Stadium':        { lat: 40.8135, lon: -74.0745, city: 'New York/New Jersey' },
  'AT&T Stadium':           { lat: 32.7473, lon: -97.0945, city: 'Dallas' },
  'SoFi Stadium':           { lat: 33.9535, lon: -118.3392, city: 'Los Angeles' },
  "Levi's Stadium":         { lat: 37.4033, lon: -121.9694, city: 'San Francisco' },
  'Hard Rock Stadium':      { lat: 25.9579, lon: -80.2389, city: 'Miami' },
  'Lincoln Financial Field':{ lat: 39.9008, lon: -75.1676, city: 'Philadelphia' },
  'Gillette Stadium':       { lat: 42.0909, lon: -71.2643, city: 'Boston' },
  'Arrowhead Stadium':      { lat: 39.0489, lon: -94.4839, city: 'Kansas City' },
  'NRG Stadium':            { lat: 29.6847, lon: -95.4107, city: 'Houston' },
  'Lumen Field':            { lat: 47.5952, lon: -122.3316, city: 'Seattle' },
  'Allegiant Stadium':      { lat: 36.0909, lon: -115.1833, city: 'Las Vegas' },
  'BMO Field':              { lat: 43.6332, lon: -79.4185, city: 'Toronto' },
  'BC Place':               { lat: 49.2767, lon: -123.1118, city: 'Vancouver' },
  'Estadio Azteca':         { lat: 19.3029, lon: -99.1504, city: 'Mexico City' },
  'Estadio BBVA':           { lat: 25.6693, lon: -100.2479, city: 'Monterrey' },
  'Estadio Akron':          { lat: 20.6892, lon: -103.4672, city: 'Guadalajara' },
};

interface OWMForecastEntry {
  dt: number;
  main: { temp: number; feels_like: number; humidity: number };
  weather: Array<{ description: string }>;
  wind: { speed: number };
  rain?: { '3h': number };
}

interface OWMForecastResponse {
  list: OWMForecastEntry[];
}

function findVenueCoords(venue: string): VenueCoords | null {
  if (VENUE_COORDS[venue]) return VENUE_COORDS[venue];

  // Partial name match as fallback
  const key = Object.keys(VENUE_COORDS).find(
    (k) =>
      venue.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(venue.toLowerCase())
  );
  return key ? VENUE_COORDS[key] : null;
}

export async function getMatchWeather(
  venue: string,
  matchDateUtc: Date
): Promise<WeatherData | null> {
  const coords = findVenueCoords(venue);
  if (!coords) {
    logger.debug('No venue coordinates found, skipping weather', { venue });
    return null;
  }

  try {
    const response = await withRetry(
      () =>
        axios.get<OWMForecastResponse>(
          'https://api.openweathermap.org/data/2.5/forecast',
          {
            params: {
              lat: coords.lat,
              lon: coords.lon,
              appid: config.openWeatherApiKey,
              units: 'metric',
              cnt: 40,
            },
            timeout: 10000,
          }
        ),
      { maxAttempts: 2, baseDelayMs: 1500 },
      `weather-${venue}`
    );

    // Pick forecast entry closest to match kick-off (entries are 3h apart)
    const matchTs = matchDateUtc.getTime() / 1000;
    const closest = response.data.list.reduce((prev, curr) =>
      Math.abs(curr.dt - matchTs) < Math.abs(prev.dt - matchTs) ? curr : prev
    );

    return {
      temp: Math.round(closest.main.temp),
      feelsLike: Math.round(closest.main.feels_like),
      humidity: closest.main.humidity,
      description: closest.weather[0]?.description ?? '',
      windSpeed: Math.round(closest.wind.speed * 3.6), // m/s → km/h
      rain: closest.rain?.['3h'] ?? 0,
    };
  } catch (err) {
    logger.warn('Could not fetch weather, skipping', {
      venue,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
