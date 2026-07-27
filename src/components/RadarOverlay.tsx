'use client';

import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { DensityView } from '@/hooks/useDensity';
import { RADAR_CATEGORY_COLORS, type RadarCategory } from '@/lib/types';

interface RadarOverlayProps {
  /** The live MapLibre instance. */
  map: MaplibreMap | null;
  /** Which density view is active (radar layers only render for 'radar'). */
  view: DensityView;
  /** GeoJSON for the active view: one point per (grid cell, radar category). */
  radar: FeatureCollection | null;
}

const RADAR_SOURCE = 'nsn-radar-points';
const RADAR_CATEGORIES = Object.keys(RADAR_CATEGORY_COLORS) as RadarCategory[];

function heatLayerId(category: RadarCategory): string {
  return `nsn-radar-heat-${category}`;
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Renders the categorical "weather radar" overlay onto a MapLibre GL map:
 * one heatmap layer per need category (warmth/food/medical/family), each its
 * own color ramp, so different neighborhoods' unmet needs read as distinct
 * colored blobs at a glance — no per-user data, only aggregate counts.
 *
 * Imperative, like DensityOverlay — MapLibre owns these layers, not React.
 */
export function useRadarOverlay({ map, view, radar }: RadarOverlayProps) {
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // ---- CLEANUP: remove radar source & layers unless the radar view is active ----
    if (view !== 'radar') {
      for (const category of RADAR_CATEGORIES) tryRemoveLayer(map, heatLayerId(category));
      tryRemoveSource(map, RADAR_SOURCE);
      return;
    }

    if (!radar) return;

    const source = map.getSource(RADAR_SOURCE);
    if (source) {
      (source as GeoJSONSource).setData(radar);
    } else {
      map.addSource(RADAR_SOURCE, {
        type: 'geojson',
        data: radar,
      });
    }

    for (const category of RADAR_CATEGORIES) {
      const id = heatLayerId(category);
      if (map.getLayer(id)) continue;

      const rgb = hexToRgb(RADAR_CATEGORY_COLORS[category]);
      map.addLayer({
        id,
        type: 'heatmap',
        source: RADAR_SOURCE,
        filter: ['==', ['get', 'radarCategory'], category] as ExpressionSpecification,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'requestCount'],
            0, 0,
            1, 0.4,
            10, 1,
          ] as ExpressionSpecification,
          'heatmap-intensity': 0.8,
          'heatmap-radius': 32,
          'heatmap-opacity': 0.75,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, `rgba(${rgb}, 0)`,
            0.3, `rgba(${rgb}, 0.35)`,
            0.7, `rgba(${rgb}, 0.65)`,
            1, `rgba(${rgb}, 0.9)`,
          ] as ExpressionSpecification,
        },
      });
    }
  }, [map, view, radar]);
}

function tryRemoveLayer(map: MaplibreMap, id: string) {
  try {
    if (map.getLayer(id)) map.removeLayer(id);
  } catch {
    // MapLibre may throw if the layer was already removed during a style change
  }
}

function tryRemoveSource(map: MaplibreMap, id: string) {
  try {
    if (map.getSource(id)) map.removeSource(id);
  } catch {
    // May throw if layers still reference this source — remove layers first
  }
}
