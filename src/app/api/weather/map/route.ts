import { selectNearestCities, computeBounds, type LatLngBounds } from '@/lib/weatherMapPoints';
import { WEATHER_REFRESH_SECONDS } from '@/lib/weatherConfig';
import { DEFAULT_LAT, DEFAULT_LNG, coerceCoord } from '@/lib/coords';

const CITY_COUNT = 18;
// Rounds to the nearest whole degree (~110km) — coarse on purpose. Nearby
// users (same metro, roughly) land on the exact same rounded point, so they
// select the same nearest cities and share the exact same cached upstream
// fetch, instead of each getting their own slightly-different city list.
const REGION_PRECISION = 0;

interface OpenMeteoCurrent {
  temperature_2m?: number;
  weather_code?: number;
}

interface OpenMeteoEntry {
  current?: OpenMeteoCurrent;
}

export interface WeatherMapPointReading {
  name: string;
  lat: number;
  lng: number;
  tempF: number | null;
  code: number | null;
}

export interface WeatherMapPayload {
  points: WeatherMapPointReading[];
  bounds: LatLngBounds;
}

// Open-Meteo accepts comma-separated lat/lng lists (up to 100 points) in a
// single request and returns one entry per point, in the same order — one
// round trip covers every sample city instead of N separate calls.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = coerceCoord(url.searchParams.get('lat'), DEFAULT_LAT, REGION_PRECISION);
  const lng = coerceCoord(url.searchParams.get('lng'), DEFAULT_LNG, REGION_PRECISION);

  const cities = selectNearestCities(lat, lng, CITY_COUNT);
  const lats = cities.map((p) => p.lat).join(',');
  const lngs = cities.map((p) => p.lng).join(',');
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

  let entries: OpenMeteoEntry[] = [];
  try {
    const res = await fetch(forecastUrl, { next: { revalidate: WEATHER_REFRESH_SECONDS } });
    if (res.ok) {
      const data = await res.json();
      entries = Array.isArray(data) ? data : [data];
    }
  } catch {
    // Fall through with empty entries — points below just report null readings.
  }

  const points: WeatherMapPointReading[] = cities.map((point, i) => ({
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    tempF: entries[i]?.current?.temperature_2m ?? null,
    code: entries[i]?.current?.weather_code ?? null,
  }));

  const payload: WeatherMapPayload = { points, bounds: computeBounds(cities) };
  return Response.json(payload);
}
