'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeatherPayload } from '@/app/api/weather/route';
import { WEATHER_REFRESH_MS } from '@/lib/weatherConfig';
import { useGeolocatedCoords } from '@/hooks/useGeolocatedCoords';

interface WeatherState {
  data: WeatherPayload | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches current conditions (+ any active NWS heat alert) for the browser's
 * location, falling back silently to the Twin Cities if geolocation is
 * denied/unavailable — same pattern as the map's own center-finding.
 */
export function useWeather(): WeatherState {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { coords, resolved } = useGeolocatedCoords();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;
    const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather${query}`);
        if (!mountedRef.current || cancelled) return;
        if (res.ok) setData(await res.json());
        setError(null);
      } catch (e: unknown) {
        if (!mountedRef.current || cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch weather');
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    };

    fetchWeather();
    const id = setInterval(fetchWeather, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [resolved, coords]);

  return { data, loading, error };
}
