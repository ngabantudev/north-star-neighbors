'use client';

import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { DensityView } from '@/hooks/useDensity';

interface DensityOverlayProps {
  /** The live MapLibre instance. */
  map: MaplibreMap | null;
  /** Which density view is active ('off' means remove all layers). */
  view: DensityView;
  /** GeoJSON for the active view. */
  grid: FeatureCollection | null;
  anchors: FeatureCollection | null;
}

const GRID_SOURCE = 'nsn-density-grid';
const GRID_LAYER_FILL = 'nsn-density-grid-fill';
const GRID_LAYER_LINE = 'nsn-density-grid-line';
const ANCHOR_SOURCE = 'nsn-density-anchors';
const ANCHOR_LAYER = 'nsn-density-anchor-circles';

/**
 * Renders demand-supply density overlays onto a MapLibre GL map.
 *
 * This is NOT a React-framework layer component — it imperatively manages
 * MapLibre source/layer lifecycles because the library's GL pipeline expects
 * direct mutation, not a React render cycle.
 *
 * Grid view: translucent cells shaded by demand-supply ratio.
 * Anchor view: pulsing circles at civic anchor locations, sized by demand count.
 */
export function useDensityOverlay({ map, view, grid, anchors }: DensityOverlayProps) {
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // ---- CLEANUP: remove all density sources & layers when "off" ----
    if (view === 'off') {
      tryRemoveLayer(map, GRID_LAYER_LINE);
      tryRemoveLayer(map, GRID_LAYER_FILL);
      tryRemoveSource(map, GRID_SOURCE);
      tryRemoveLayer(map, ANCHOR_LAYER);
      tryRemoveSource(map, ANCHOR_SOURCE);
      return;
    }

    // ---- GRID view ----
    if (view === 'grid' && grid) {
      // First remove anchor stuff if it was showing
      tryRemoveLayer(map, ANCHOR_LAYER);
      tryRemoveSource(map, ANCHOR_SOURCE);

      const source = map.getSource(GRID_SOURCE);
      if (source) {
        (source as GeoJSONSource).setData(grid);
      } else {
        map.addSource(GRID_SOURCE, {
          type: 'geojson',
          data: grid,
        });
      }

      if (!map.getLayer(GRID_LAYER_FILL)) {
        map.addLayer({
          id: GRID_LAYER_FILL,
          type: 'fill',
          source: GRID_SOURCE,
          paint: {
            // 'step' takes [input, default_output, stop1, output1, stop2, output2, ...] —
            // the default covers everything below the first stop.
            // Ratios: 0 (supply > demand, green), <1 (amber), <999 (red), 999 (hot magenta)
            'fill-color': [
              'step',
              ['get', 'demandSupplyRatio'],
              'rgba(22, 163, 74, 0.2)',
              0.01, 'rgba(22, 163, 74, 0.2)',
              0.5, 'rgba(22, 163, 74, 0.25)',
              1, 'rgba(234, 179, 8, 0.3)',
              2, 'rgba(234, 179, 8, 0.4)',
              10, 'rgba(220, 38, 38, 0.35)',
              998, 'rgba(220, 38, 38, 0.5)',
              999, 'rgba(147, 51, 234, 0.55)',
            ],
            'fill-opacity': 0.7,
          },
        });
      }

      if (!map.getLayer(GRID_LAYER_LINE)) {
        map.addLayer({
          id: GRID_LAYER_LINE,
          type: 'line',
          source: GRID_SOURCE,
          paint: {
            'line-color': 'rgba(0, 0, 0, 0.12)',
            'line-width': 0.5,
          },
        });
      }
      return;
    }

    // ---- ANCHOR view ----
    if (view === 'anchors' && anchors) {
      // Remove grid stuff first
      tryRemoveLayer(map, GRID_LAYER_LINE);
      tryRemoveLayer(map, GRID_LAYER_FILL);
      tryRemoveSource(map, GRID_SOURCE);

      const source = map.getSource(ANCHOR_SOURCE);
      if (source) {
        (source as GeoJSONSource).setData(anchors);
      } else {
        map.addSource(ANCHOR_SOURCE, {
          type: 'geojson',
          data: anchors,
        });
      }

      if (!map.getLayer(ANCHOR_LAYER)) {
        map.addLayer({
          id: ANCHOR_LAYER,
          type: 'circle',
          source: ANCHOR_SOURCE,
          paint: {
            'circle-radius': [
              'step',
              ['get', 'demandSupplyRatio'],
              8, // no demand, small dot
              0, 8,
              0.5, 12,
              1, 18,
              5, 26,
              998, 34,
              999, 44,
            ],
            'circle-color': [
              'step',
              ['get', 'demandSupplyRatio'],
              'rgba(22, 163, 74, 0.55)',
              0.01, 'rgba(22, 163, 74, 0.55)',
              0.5, 'rgba(234, 179, 8, 0.6)',
              1, 'rgba(234, 179, 8, 0.7)',
              10, 'rgba(220, 38, 38, 0.65)',
              998, 'rgba(220, 38, 38, 0.75)',
              999, 'rgba(147, 51, 234, 0.8)',
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-blur': 0.5,
          },
        });
      }
    }
  }, [map, view, grid, anchors]);
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