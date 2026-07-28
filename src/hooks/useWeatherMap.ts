'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeatherMapPayload, WeatherMapPointReading } from '@/app/api/weather/map/route';
import type { LatLngBounds } from '@/lib/weatherMapPoints';
import { WEATHER_REFRESH_MS } from '@/lib/weatherConfig';

interface WeatherMapState {
  points: WeatherMapPointReading[];
  /** The geographic box those points span — null until the first response arrives. */
  bounds: LatLngBounds | null;
  loading: boolean;
  error: string | null;
}

interface UseWeatherMapOptions {
  /** Current map viewport. Null while unknown — nothing fetches until it's set. */
  bounds: LatLngBounds | null;
  /** Only fetches while true — no reason to track/fetch for a layer nobody's viewing. */
  enabled: boolean;
}

/**
 * Fetches current temperature for every city within the given map viewport.
 * The caller passes in the live MapLibre bounds (debounced on pan/zoom)
 * rather than this hook tracking its own location, since "what's visible"
 * is a map-viewport concept, not a geolocation one. Zoomed-out decluttering
 * (nearby readings merging into one averaged number) happens client-side in
 * TemperatureLayer via MapLibre's own marker clustering, not here.
 */
export function useWeatherMap({ bounds, enabled }: UseWeatherMapOptions): WeatherMapState {
  const [points, setPoints] = useState<WeatherMapPointReading[]>([]);
  const [responseBounds, setResponseBounds] = useState<LatLngBounds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !bounds) return;
    let cancelled = false;
    const query = `?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;

    const fetchMap = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather/map${query}`);
        if (!mountedRef.current || cancelled) return;
        if (res.ok) {
          const data: WeatherMapPayload = await res.json();
          setPoints(data.points);
          setResponseBounds(data.bounds);
        }
        setError(null);
      } catch (e: unknown) {
        if (!mountedRef.current || cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch weather map');
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    };

    fetchMap();
    const id = setInterval(fetchMap, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, bounds]);

  return { points, bounds: responseBounds, loading, error };
}
