'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeatherMapPayload, WeatherMapPointReading } from '@/app/api/weather/map/route';
import type { LatLngBounds } from '@/lib/weatherMapPoints';
import { WEATHER_REFRESH_MS } from '@/lib/weatherConfig';
import { useGeolocatedCoords } from '@/hooks/useGeolocatedCoords';

interface WeatherMapState {
  points: WeatherMapPointReading[];
  /** Geographic box the points span (+ padding) — null until the first response arrives. */
  bounds: LatLngBounds | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches current temperature at the ~18 real cities nearest the browser's
 * location (falling back to the Twin Cities if geolocation is denied), for
 * the temperature map overlay. Separate from useWeather() (the single point
 * for the toggle's own label/heat alert) since this one is a batched
 * multi-location, region-aware request.
 */
export function useWeatherMap(): WeatherMapState {
  const [points, setPoints] = useState<WeatherMapPointReading[]>([]);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
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

    const fetchMap = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/weather/map${query}`);
        if (!mountedRef.current || cancelled) return;
        if (res.ok) {
          const data: WeatherMapPayload = await res.json();
          setPoints(data.points);
          setBounds(data.bounds);
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
  }, [resolved, coords]);

  return { points, bounds, loading, error };
}
