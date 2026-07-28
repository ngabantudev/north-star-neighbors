'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useWeather } from '@/hooks/useWeather';
import type { WeatherPayload } from '@/app/api/weather/route';

interface WeatherLayerContextValue {
  /** Whether the temperature map overlay is toggled on. */
  active: boolean;
  toggle: () => void;
  /** Single-point conditions (+ real NWS heat alert) for the toggle button's own label. */
  current: WeatherPayload | null;
  currentLoading: boolean;
}

const WeatherLayerContext = createContext<WeatherLayerContextValue | null>(null);

/**
 * Wraps the app shell so the weather toggle button (rendered in AppNav, in
 * both the desktop header and the mobile bottom nav) shares one on/off flag
 * and one single-point conditions fetch with the map overlay itself. The
 * overlay's actual city/state data is NOT here — it's driven by the live
 * MapLibre viewport, which only exists in page.tsx, so that fetch lives
 * there instead (see useWeatherMap).
 */
export function WeatherLayerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const weather = useWeather();

  const value: WeatherLayerContextValue = {
    active,
    toggle: () => setActive((a) => !a),
    current: weather.data,
    currentLoading: weather.loading,
  };

  return <WeatherLayerContext.Provider value={value}>{children}</WeatherLayerContext.Provider>;
}

export function useWeatherLayer(): WeatherLayerContextValue {
  const ctx = useContext(WeatherLayerContext);
  if (!ctx) throw new Error('useWeatherLayer must be used within a WeatherLayerProvider');
  return ctx;
}
