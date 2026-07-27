'use client';

import { useEffect, useState, useRef } from 'react';
import type { FeatureCollection } from 'geojson';

export type DensityView = 'off' | 'grid' | 'radar';

interface DensityState {
  view: DensityView;
  setView: (view: DensityView) => void;
  /** GeoJSON FeatureCollection for the grid view, null while loading or inactive. */
  grid: FeatureCollection | null;
  /** GeoJSON FeatureCollection for the radar view, null while loading or inactive. */
  radar: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

const POLL_MS = 30000; // refresh density data every 30s

const ENDPOINT_BY_VIEW: Record<'grid' | 'radar', string> = {
  grid: '/api/density/grid',
  radar: '/api/density/radar',
};

/**
 * Fetches demand-supply or categorical-request GeoJSON from the PostGIS-backed
 * density API endpoints. Only fetches when the overlay is active (view !==
 * 'off') to avoid wasted database load.
 */
export function useDensity(): DensityState {
  const [view, setView] = useState<DensityView>('off');
  const [grid, setGrid] = useState<FeatureCollection | null>(null);
  const [radar, setRadar] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (view === 'off') {
      // Syncing local state to the view toggle, not a local computation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrid(null);
      setRadar(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const endpoint = ENDPOINT_BY_VIEW[view];
    const setData = view === 'grid' ? setGrid : setRadar;

    const fetchDensity = async () => {
      setLoading(true);
      try {
        const res = await fetch(endpoint);
        if (!mountedRef.current || cancelled) return;
        if (res.ok) setData(await res.json());
        setError(null);
      } catch (e: unknown) {
        if (!mountedRef.current || cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch density data');
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    };

    fetchDensity();
    const id = setInterval(fetchDensity, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [view]);

  return { view, setView, grid, radar, loading, error };
}
