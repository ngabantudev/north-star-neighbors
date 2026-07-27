'use client';

import { useEffect, useRef } from 'react';
import {
  Map as MaplibreMap,
  Marker as MaplibreMarker,
  NavigationControl,
  GeolocateControl,
} from 'maplibre-gl';
import { formatCountdown } from '@/lib/time';
import { renderCategoryIconStack } from '@/lib/categoryIcons';
import type { DropCategory } from '@/lib/types';

export const TWIN_CITIES_CENTER: [number, number] = [-93.265, 44.9778];

// OpenFreeMap hosts free, keyless vector tiles — no API key/billing account
// needed, which matters for a tool meant to work in a disruption scenario.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const URGENT_FRACTION = 0.2; // last 20% of a pin's lifetime counts as "about to expire"
const FRESH_COLOR = [22, 163, 74] as const; // #16a34a
const URGENT_COLOR = [220, 38, 38] as const; // #dc2626
const BASE_SCALE = 1.05;
const URGENT_SCALE = 1.25;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Whether this pin belongs to (was created or claimed by) the current browser. */
  isMine?: boolean;
  /** ISO timestamps. When both are present, the pin shows a live countdown and
   *  shifts from green to red / grows in scale as it nears expiry. */
  createdAt?: string;
  expiresAt?: string;
  /** Shown as a small stacked-icon cluster inside the pin. */
  categories?: DropCategory[];
}

interface MapProps {
  markers: MapMarker[];
  onMarkerClick?: (id: string) => void;
  /** Fires the instant a marker's countdown hits zero (before the next poll would catch it). */
  onMarkerExpire?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  draggableMarker?: {
    lat: number;
    lng: number;
    onDragEnd: (lat: number, lng: number) => void;
  };
  /** Off for small preview maps, where zoom/geolocate controls would be cramped. Defaults to true. */
  showControls?: boolean;
  className?: string;
  /** Fires with the live MapLibre instance once created, and with null on teardown.
   *  Lets parents (e.g. the density overlay) attach without this component knowing about them. */
  onMapInstance?: (map: MaplibreMap | null) => void;
}

function urgencyStyle(fractionRemaining: number): { background: string; scale: number } {
  const clamped = Math.max(0, Math.min(1, fractionRemaining));
  const t = 1 - clamped; // 0 = just created, 1 = about to expire
  const [r1, g1, b1] = FRESH_COLOR;
  const [r2, g2, b2] = URGENT_COLOR;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  const scale = clamped <= URGENT_FRACTION ? URGENT_SCALE : BASE_SCALE;
  return { background: `rgb(${r}, ${g}, ${b})`, scale };
}

interface MarkerTiming {
  createdAtMs: number;
  expiresAtMs: number;
}

export function Map({
  markers,
  onMarkerClick,
  onMarkerExpire,
  center,
  zoom = 10,
  draggableMarker,
  showControls = true,
  className,
  onMapInstance,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRefs = useRef<Record<string, MaplibreMarker>>({});
  const pinRefs = useRef<Record<string, HTMLDivElement>>({});
  const badgeRefs = useRef<Record<string, HTMLDivElement>>({});
  const timingRefs = useRef<Record<string, MarkerTiming>>({});
  const dragMarkerRef = useRef<MaplibreMarker | null>(null);
  const onMarkerExpireRef = useRef(onMarkerExpire);
  const onMapInstanceRef = useRef(onMapInstance);

  useEffect(() => {
    onMarkerExpireRef.current = onMarkerExpire;
  });

  useEffect(() => {
    onMapInstanceRef.current = onMapInstance;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: center ?? TWIN_CITIES_CENTER,
      zoom,
    });
    if (showControls) {
      map.addControl(new NavigationControl(), 'top-right');
      map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
    }
    mapRef.current = map;
    onMapInstanceRef.current?.(map);

    // Tearing this instance down (below) aborts its in-flight tile/style
    // requests, which MapLibre reports as an 'error' event on its way out —
    // most visibly under React Strict Mode's dev-only double-invoke, which
    // mounts, immediately tears down, then mounts again. That's noise, not a
    // real failure, so once torn down we stop logging from this instance.
    let torndown = false;
    map.on('error', (e) => {
      if (torndown) return;
      console.error('maplibre error', e.error?.message ?? e);
    });

    return () => {
      torndown = true;
      map.remove();
      mapRef.current = null;
      onMapInstanceRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (center) map.easeTo({ center, zoom, duration: 600 });
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set(markers.map((m) => m.id));
    for (const id of Object.keys(markerRefs.current)) {
      if (!seen.has(id)) {
        markerRefs.current[id].remove();
        delete markerRefs.current[id];
        delete pinRefs.current[id];
        delete badgeRefs.current[id];
        delete timingRefs.current[id];
      }
    }

    for (const m of markers) {
      if (m.createdAt && m.expiresAt) {
        timingRefs.current[m.id] = {
          createdAtMs: new Date(m.createdAt).getTime(),
          expiresAtMs: new Date(m.expiresAt).getTime(),
        };
      } else {
        delete timingRefs.current[m.id];
      }

      const existing = markerRefs.current[m.id];
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        const pin = pinRefs.current[m.id];
        if (pin) pin.style.borderColor = m.isMine ? '#0062b2' : '#ffffff';
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'flex flex-col items-center gap-1 cursor-pointer';
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClick?.(m.id);
      });

      if (m.expiresAt) {
        const badge = document.createElement('div');
        badge.className = 'nsn-timer-badge';
        const timing = timingRefs.current[m.id];
        badge.textContent = formatCountdown((timing?.expiresAtMs ?? 0) - Date.now());
        wrapper.appendChild(badge);
        badgeRefs.current[m.id] = badge;
      }

      const pin = document.createElement('div');
      pin.className = 'nsn-pin';
      pin.style.borderColor = m.isMine ? '#0062b2' : '#ffffff';
      if (m.categories && m.categories.length > 0) {
        // Counter-rotated so icons stay upright against the pin's own -45deg rotation.
        const iconLayer = document.createElement('div');
        iconLayer.className = 'nsn-pin-icons';
        iconLayer.innerHTML = renderCategoryIconStack(m.categories);
        pin.appendChild(iconLayer);
      }
      wrapper.appendChild(pin);
      pinRefs.current[m.id] = pin;

      markerRefs.current[m.id] = new MaplibreMarker({ element: wrapper, anchor: 'bottom' })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    const tick = () => {
      for (const [id, timing] of Object.entries(timingRefs.current)) {
        const remaining = timing.expiresAtMs - Date.now();
        const badge = badgeRefs.current[id];
        const pin = pinRefs.current[id];

        if (remaining <= 0) {
          markerRefs.current[id]?.remove();
          delete markerRefs.current[id];
          delete pinRefs.current[id];
          delete badgeRefs.current[id];
          delete timingRefs.current[id];
          onMarkerExpireRef.current?.(id);
          continue;
        }

        if (badge) badge.textContent = formatCountdown(remaining);
        if (pin) {
          const total = timing.expiresAtMs - timing.createdAtMs;
          const fractionRemaining = total > 0 ? remaining / total : 1;
          const { background, scale } = urgencyStyle(fractionRemaining);
          pin.style.background = background;
          pin.style.transform = `rotate(-45deg) scale(${scale})`;
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !draggableMarker) return;

    if (!dragMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'nsn-pin nsn-pin-drag';
      const marker = new MaplibreMarker({ element: el, draggable: true })
        .setLngLat([draggableMarker.lng, draggableMarker.lat])
        .addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        draggableMarker.onDragEnd(lat, lng);
      });
      dragMarkerRef.current = marker;
    } else {
      dragMarkerRef.current.setLngLat([draggableMarker.lng, draggableMarker.lat]);
    }

    return () => {
      dragMarkerRef.current?.remove();
      dragMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggableMarker?.lat === undefined]);

  useEffect(() => {
    if (dragMarkerRef.current && draggableMarker) {
      dragMarkerRef.current.setLngLat([draggableMarker.lng, draggableMarker.lat]);
    }
  }, [draggableMarker?.lat, draggableMarker?.lng]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
