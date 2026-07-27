'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { useWeatherMap } from '@/hooks/useWeatherMap';
import type { WeatherPayload } from '@/app/api/weather/route';
import type { WeatherMapPointReading } from '@/app/api/weather/map/route';
import type { LatLngBounds } from '@/lib/weatherMapPoints';

interface WeatherLayerContextValue {
  /** Whether the temperature map overlay is toggled on. */
  active: boolean;
  toggle: () => void;
  /** Single-point conditions (+ real NWS heat alert) for the toggle button's own label. */
  current: WeatherPayload | null;
  currentLoading: boolean;
  /** Current temp at the cities nearest the user (see weatherMapPoints.ts), for the map overlay. */
  points: WeatherMapPointReading[];
  /** The geographic box those points span — null until the first response arrives. */
  bounds: LatLngBounds | null;
}

const WeatherLayerContext = createContext<WeatherLayerContextValue | null>(null);

/**
 * Wraps the app shell so the weather toggle button (rendered in AppNav, in
 * both the desktop header and the mobile bottom nav) and the actual map
 * overlay (rendered from page.tsx, which is the only place with a live
 * MapLibre instance) share one on/off flag and one pair of data fetches —
 * without this, having the button live in global nav while the layer only
 * makes sense on the map page would mean either duplicating the fetches or
 * threading props across the layout/page boundary.
 */
export function WeatherLayerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const weather = useWeather();
  const weatherMap = useWeatherMap();

  const value: WeatherLayerContextValue = {
    active,
    toggle: () => setActive((a) => !a),
    current: weather.data,
    currentLoading: weather.loading,
    points: weatherMap.points,
    bounds: weatherMap.bounds,
  };

  return <WeatherLayerContext.Provider value={value}>{children}</WeatherLayerContext.Provider>;
}

export function useWeatherLayer(): WeatherLayerContextValue {
  const ctx = useContext(WeatherLayerContext);
  if (!ctx) throw new Error('useWeatherLayer must be used within a WeatherLayerProvider');
  return ctx;
}
