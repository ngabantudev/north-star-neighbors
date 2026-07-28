import { citiesInBounds, type LatLngBounds, type WeatherMapPoint } from '@/lib/weatherMapPoints';
import { WEATHER_REFRESH_SECONDS } from '@/lib/weatherConfig';

// Snaps viewport edges outward to the nearest whole degree (~110km) —
// coarse on purpose, so users looking at roughly the same area land on the
// same rounded box and share the same cached upstream fetch. Must round
// OUTWARD (never to-nearest): rounding a small viewport's south edge up
// (e.g. 44.7 -> 45) can push real in-view content like Minneapolis
// (44.9778) outside the "rounded" box entirely, silently returning nothing.
//
// Detail level (individual city vs. clustered average) is no longer decided
// here — the client clusters these points itself (MapLibre's built-in
// geojson clustering) based on actual screen proximity at the current zoom,
// which reads much more like a real map (deflock.org-style) than a
// political-boundary cutoff. This just returns every city in view.
const CITY_CAP = 150; // legibility ceiling + bounds how much fetchTemps has to chunk
const OPEN_METEO_CHUNK_SIZE = 100;

// A box around the Twin Cities — used only if the client sends no viewport
// at all (shouldn't normally happen; the map always has bounds).
const DEFAULT_BOUNDS: LatLngBounds = { north: 47, south: 43, east: -91, west: -95 };

interface OpenMeteoCurrent {
  temperature_2m?: number;
  weather_code?: number;
}

interface OpenMeteoEntry {
  current?: OpenMeteoCurrent;
}

export interface WeatherMapPointReading {
  /** City name — display-only, not rendered as a map label. */
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

function edge(raw: string | null, fallback: number, round: (n: number) => number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? round(n) : fallback;
}

function parseBounds(url: URL): LatLngBounds {
  const north = edge(url.searchParams.get('north'), DEFAULT_BOUNDS.north, Math.ceil);
  const south = edge(url.searchParams.get('south'), DEFAULT_BOUNDS.south, Math.floor);
  const east = edge(url.searchParams.get('east'), DEFAULT_BOUNDS.east, Math.ceil);
  const west = edge(url.searchParams.get('west'), DEFAULT_BOUNDS.west, Math.floor);

  // A degenerate zero-span box is only possible if the raw north/south (or
  // east/west) were already equal pre-rounding — pad it back out just in case.
  return {
    north: north > south ? north : north + 1,
    south,
    east: east > west ? east : east + 1,
    west,
  };
}

/** Batched Open-Meteo current-conditions fetch, chunked to respect its ~100-location limit. */
async function fetchTemps(points: WeatherMapPoint[]): Promise<(OpenMeteoCurrent | null)[]> {
  const chunks: WeatherMapPoint[][] = [];
  for (let i = 0; i < points.length; i += OPEN_METEO_CHUNK_SIZE) {
    chunks.push(points.slice(i, i + OPEN_METEO_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const lats = chunk.map((p) => p.lat).join(',');
      const lngs = chunk.map((p) => p.lng).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
      try {
        const res = await fetch(url, { next: { revalidate: WEATHER_REFRESH_SECONDS } });
        if (!res.ok) return chunk.map(() => null);
        const data = await res.json();
        const entries: OpenMeteoEntry[] = Array.isArray(data) ? data : [data];
        return chunk.map((_, i) => entries[i]?.current ?? null);
      } catch {
        return chunk.map(() => null);
      }
    }),
  );

  return chunkResults.flat();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bounds = parseBounds(url);

  const cities = citiesInBounds(bounds, CITY_CAP);
  const currents = await fetchTemps(cities);
  const points: WeatherMapPointReading[] = cities.map((city, i) => ({
    name: city.name,
    lat: city.lat,
    lng: city.lng,
    tempF: currents[i]?.temperature_2m ?? null,
    code: currents[i]?.weather_code ?? null,
  }));

  const payload: WeatherMapPayload = { points, bounds };
  return Response.json(payload);
}
