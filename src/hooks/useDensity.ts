'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { FeatureCollection } from 'geojson';

export type DensityView = 'off' | 'grid' | 'anchors';

interface DensityState {
  view: DensityView;
  toggle: () => void;
  /** GeoJSON FeatureCollection, null while loading or when view is 'off'. */
  grid: FeatureCollection | null;
  anchors: FeatureCollection | null;
  loading: boolean;
  error: string | null;
}

const POLL_MS = 30000; // refresh density data every 30s

/**
 * Fetches demand-supply density GeoJSON from the PostGIS-backed API endpoints.
 * Only fetches when the overlay is active (view !== 'off') to avoid wasted
 * database load.
 */
export function useDensity(): DensityState {
  const [view, setView] = useState<DensityView>('off');
  const [grid, setGrid] = useState<FeatureCollection | null>(null);
  const [anchors, setAnchors] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const toggle = useCallback(() => {
    setView((prev) => {
      if (prev === 'off') return 'grid';
      if (prev === 'grid') return 'anchors';
      return 'off';
    });
  }, []);

  useEffect(() => {
    if (view === 'off') {
      // Syncing local state to the view toggle, not a local computation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrid(null);
      setAnchors(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDensity = async () => {
      setLoading(true);
      try {
        const [gridRes, anchorRes] = await Promise.all([
          fetch('/api/density/grid'),
          fetch('/api/density/anchors'),
        ]);
        if (!mountedRef.current || cancelled) return;
        if (gridRes.ok) setGrid(await gridRes.json());
        if (anchorRes.ok) setAnchors(await anchorRes.json());
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

  return { view, toggle, grid, anchors, loading, error };
}