import { WEATHER_REFRESH_SECONDS } from '@/lib/weatherConfig';
import { DEFAULT_LAT, DEFAULT_LNG, coerceCoord } from '@/lib/coords';

// Deliberately NOT force-dynamic: unlike the drops/density routes, weather
// tolerates a few minutes of staleness, so we let the fetches below cache
// and share across every concurrent user instead of each one triggering its
// own upstream call — force-dynamic would override any fetch-level
// `next.revalidate` back to no-store.

// Rounds lat/lng to ~1km so nearby users share one cached upstream call
// instead of each exact-precision geolocation reading missing the cache.
const COORD_PRECISION = 2;

// NWS requires an identifying User-Agent (no API key) — see api.weather.gov docs.
const NWS_USER_AGENT = 'north-star-neighbors mutual-aid map (github.com/north-star-neighbors)';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
}

interface NwsAlertFeature {
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
  };
}

interface NwsAlertsResponse {
  features?: NwsAlertFeature[];
}

export interface HeatAlert {
  event: string;
  headline: string;
  severity: string;
}

export interface WeatherPayload {
  tempF: number | null;
  feelsLikeF: number | null;
  code: number | null;
  heatAlert: HeatAlert | null;
}

async function fetchCurrentConditions(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit`;
  const res = await fetch(url, { next: { revalidate: WEATHER_REFRESH_SECONDS } });
  if (!res.ok) return null;
  const data: OpenMeteoResponse = await res.json();
  return data.current ?? null;
}

// A synthetic temperature threshold would be a guess dressed up as fact — this
// instead surfaces the National Weather Service's own active alert for the
// point, so the nudge only appears when a real Heat Advisory / Excessive Heat
// Warning is in effect (not whenever we personally think it feels hot).
async function fetchHeatAlert(lat: number, lng: number): Promise<HeatAlert | null> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat},${lng}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': NWS_USER_AGENT, Accept: 'application/geo+json' },
      next: { revalidate: WEATHER_REFRESH_SECONDS },
    });
    if (!res.ok) return null;
    const data: NwsAlertsResponse = await res.json();
    const heatFeature = (data.features ?? []).find((f) => /heat/i.test(f.properties?.event ?? ''));
    if (!heatFeature?.properties?.event || !heatFeature.properties.headline) return null;
    return {
      event: heatFeature.properties.event,
      headline: heatFeature.properties.headline,
      severity: heatFeature.properties.severity ?? 'Unknown',
    };
  } catch {
    // NWS only covers US points and can be flaky — a missing alert should
    // never block showing the current temperature.
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = coerceCoord(url.searchParams.get('lat'), DEFAULT_LAT, COORD_PRECISION);
  const lng = coerceCoord(url.searchParams.get('lng'), DEFAULT_LNG, COORD_PRECISION);

  const [current, heatAlert] = await Promise.all([
    fetchCurrentConditions(lat, lng).catch(() => null),
    fetchHeatAlert(lat, lng),
  ]);

  const payload: WeatherPayload = {
    tempF: current?.temperature_2m ?? null,
    feelsLikeF: current?.apparent_temperature ?? null,
    code: current?.weather_code ?? null,
    heatAlert,
  };

  return Response.json(payload);
}
