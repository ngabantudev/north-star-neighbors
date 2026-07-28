'use client';

import { useEffect, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}

interface GeolocatedState {
  /** Null until geolocation succeeds; stays null forever if denied/unavailable. */
  coords: Coords | null;
  /** True once there's an answer either way — safe to fetch (with or without coords). */
  resolved: boolean;
}

/**
 * Resolves the browser's coordinates once, or confirms there are none to
 * get (denied/unavailable) — callers fall back to a sensible server-side
 * default rather than blocking. Shared by useWeather and useWeatherMap so
 * this boilerplate isn't duplicated across both.
 */
export function useGeolocatedCoords(): GeolocatedState {
  const [state, setState] = useState<GeolocatedState>({ coords: null, resolved: false });

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) {
      // Reporting a platform capability check, not deriving from props/state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ coords: null, resolved: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setState({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, resolved: true });
      },
      () => {
        if (cancelled) return;
        setState({ coords: null, resolved: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
