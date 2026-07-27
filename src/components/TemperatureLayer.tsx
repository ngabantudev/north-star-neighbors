'use client';

import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, ImageSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { LatLngBounds } from '@/lib/weatherMapPoints';
import { tempToRgb } from '@/lib/temperatureColor';
import type { WeatherMapPointReading } from '@/app/api/weather/map/route';

interface TemperatureLayerProps {
  /** The live MapLibre instance. */
  map: MaplibreMap | null;
  /** Whether the temperature map is toggled on. */
  active: boolean;
  /** Current readings for the ~18 cities nearest the user (see weatherMapPoints.ts). */
  points: WeatherMapPointReading[];
  /** The geographic box those points span — null until the first response arrives. */
  bounds: LatLngBounds | null;
}

const IMAGE_SOURCE = 'nsn-temp-image';
const IMAGE_LAYER = 'nsn-temp-raster';
const LABEL_SOURCE = 'nsn-temp-labels';
const LABEL_LAYER = 'nsn-temp-labels-layer';

const GRID_W = 100; // interpolation grid width; height derived from the bounds' aspect ratio
const UPSCALE = 6; // final canvas = GRID_W*UPSCALE px wide, smoothed on the way up for a soft, blended look
const IDW_POWER = 2; // classic inverse-distance-weighting exponent

/**
 * Inverse-distance-weights every sample city's temperature across a coarse
 * grid, colors each cell (blue=cold to red/magenta=dangerous heat), then
 * upscales with canvas smoothing so city-to-city transitions read as a soft
 * gradient instead of blocky cells — the same idea a TV weather map's
 * isotherm fill is going for, just computed client-side from ~18 real points
 * instead of a full model grid.
 */
function buildTemperatureCanvas(points: WeatherMapPointReading[], bounds: LatLngBounds): HTMLCanvasElement | null {
  const valid = points.filter((p): p is WeatherMapPointReading & { tempF: number } => p.tempF != null);
  if (valid.length === 0) return null;

  const { north, south, east, west } = bounds;
  const latSpan = north - south;
  const lngSpan = east - west;
  // Longitude degrees are shorter than latitude degrees away from the equator —
  // scale by cos(latitude) so distance weighting isn't stretched east-west.
  const cosLat = Math.cos((((north + south) / 2) * Math.PI) / 180);
  const gridH = Math.max(1, Math.round(GRID_W * (latSpan / (lngSpan * cosLat))));

  const small = document.createElement('canvas');
  small.width = GRID_W;
  small.height = gridH;
  const ctx = small.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(GRID_W, gridH);

  for (let y = 0; y < gridH; y++) {
    const lat = north - (y / Math.max(1, gridH - 1)) * latSpan;
    for (let x = 0; x < GRID_W; x++) {
      const lng = west + (x / Math.max(1, GRID_W - 1)) * lngSpan;

      let weightSum = 0;
      let valueSum = 0;
      let exact: number | null = null;
      for (const p of valid) {
        const dx = (lng - p.lng) * cosLat;
        const dy = lat - p.lat;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1e-6) {
          exact = p.tempF;
          break;
        }
        const w = 1 / Math.pow(distSq, IDW_POWER / 2);
        weightSum += w;
        valueSum += w * p.tempF;
      }
      const temp = exact ?? (weightSum > 0 ? valueSum / weightSum : valid[0].tempF);
      const [r, g, b] = tempToRgb(temp);
      const idx = (y * GRID_W + x) * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 165; // translucent so streets/labels show through
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const big = document.createElement('canvas');
  big.width = GRID_W * UPSCALE;
  big.height = gridH * UPSCALE;
  const bigCtx = big.getContext('2d');
  if (!bigCtx) return small;
  bigCtx.imageSmoothingEnabled = true;
  bigCtx.imageSmoothingQuality = 'high';
  bigCtx.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

function buildLabelsGeoJSON(points: WeatherMapPointReading[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points
      .filter((p) => p.tempF != null)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { label: `${p.name}\n${Math.round(p.tempF as number)}°` },
      })),
  };
}

export function useTemperatureLayer({ map, active, points, bounds }: TemperatureLayerProps) {
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    if (!active) {
      tryRemoveLayer(map, LABEL_LAYER);
      tryRemoveSource(map, LABEL_SOURCE);
      tryRemoveLayer(map, IMAGE_LAYER);
      tryRemoveSource(map, IMAGE_SOURCE);
      return;
    }

    if (points.length === 0 || !bounds) return;
    const canvas = buildTemperatureCanvas(points, bounds);
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const { north, south, east, west } = bounds;
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ];

    const imageSource = map.getSource(IMAGE_SOURCE) as ImageSource | undefined;
    if (imageSource) {
      imageSource.updateImage({ url: dataUrl, coordinates });
    } else {
      map.addSource(IMAGE_SOURCE, { type: 'image', url: dataUrl, coordinates });
      map.addLayer({
        id: IMAGE_LAYER,
        type: 'raster',
        source: IMAGE_SOURCE,
        paint: { 'raster-opacity': 0.55, 'raster-fade-duration': 300 },
      });
    }

    const labelData = buildLabelsGeoJSON(points);
    const labelSource = map.getSource(LABEL_SOURCE) as GeoJSONSource | undefined;
    if (labelSource) {
      labelSource.setData(labelData);
    } else {
      map.addSource(LABEL_SOURCE, { type: 'geojson', data: labelData });
      map.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: LABEL_SOURCE,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-justify': 'center',
          'text-anchor': 'center',
          'text-line-height': 1.1,
          // Only ~18 points total — always show them rather than losing to
          // the basemap's own city-name labels in the shared collision index.
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        },
      });
    }
  }, [map, active, points, bounds]);
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
