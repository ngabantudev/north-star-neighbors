'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { FeatureCollection } from 'geojson';

export type DensityView = 'off' | 'grid';

interface DensityState {
  view: DensityView;
  toggle: () => void;
  /** GeoJSON FeatureCollection, null while loading or when view is 'off'. */
  grid: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

const POLL_MS = 30000; // refresh density data every 30s

/**
 * Fetches demand-supply density GeoJSON from the PostGIS-backed API endpoint.
 * Only fetches when the overlay is active (view !== 'off') to avoid wasted
 * database load.
 */
export function useDensity(): DensityState {
  const [view, setView] = useState<DensityView>('off');
  const [grid, setGrid] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const toggle = useCallback(() => {
    setView((prev) => (prev === 'off' ? 'grid' : 'off'));
  }, []);

  useEffect(() => {
    if (view === 'off') {
      // Syncing local state to the view toggle, not a local computation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrid(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDensity = async () => {
      setLoading(true);
      try {
        const gridRes = await fetch('/api/density/grid');
        if (!mountedRef.current || cancelled) return;
        if (gridRes.ok) setGrid(await gridRes.json());
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

  return { view, toggle, grid, loading, error };
}