'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { Map, TWIN_CITIES_CENTER } from '@/components/Map';
import { DropDrawer } from '@/components/DropDrawer';
import { DropDialog } from '@/components/DropDialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIdentity } from '@/hooks/useIdentity';
import { useMyDrops } from '@/hooks/useMyDrops';
import { useDensity, type DensityView } from '@/hooks/useDensity';
import { useDensityOverlay } from '@/components/DensityOverlay';
import { useRadarOverlay } from '@/components/RadarOverlay';
import { useTemperatureLayer } from '@/components/TemperatureLayer';
import { useWeatherLayer } from '@/components/WeatherLayerProvider';
import { useWeatherMap } from '@/hooks/useWeatherMap';
import { expireDrop } from '@/app/actions';
import {
  RADAR_CATEGORY_COLORS,
  RADAR_CATEGORY_LABELS,
  type DropSummary,
  type RadarCategory,
  type TravelMode,
} from '@/lib/types';
import { TEMPERATURE_GRADIENT_CSS } from '@/lib/temperatureColor';
import type { LatLngBounds } from '@/lib/weatherMapPoints';

// How long to wait after the map stops moving before re-fetching the
// temperature map for the new viewport — coalesces a burst of pan/zoom
// events into one request instead of firing on every settle.
const VIEWPORT_DEBOUNCE_MS = 400;
const POLL_MS = 6000;

const GRID_LEGEND = [
  { color: 'rgba(22, 163, 74, 0.85)', label: 'Well supplied' },
  { color: 'rgba(234, 179, 8, 0.85)', label: 'Balanced' },
  { color: 'rgba(220, 38, 38, 0.85)', label: 'High demand' },
  { color: 'rgba(147, 51, 234, 0.85)', label: 'Unmet demand' },
] as const;

const RADAR_LEGEND = (Object.keys(RADAR_CATEGORY_COLORS) as RadarCategory[]).map((category) => ({
  color: RADAR_CATEGORY_COLORS[category],
  label: RADAR_CATEGORY_LABELS[category],
}));

const VIEW_LABEL: Record<DensityView, string> = {
  off: 'Off',
  grid: 'Grid',
  radar: 'Radar',
};

function HomePageInner() {
  const identity = useIdentity();
  const { records, add, remove, byId } = useMyDrops();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [publicDrops, setPublicDrops] = useState<Record<string, DropSummary>>({});
  const [myDropDetails, setMyDropDetails] = useState<Record<string, DropSummary>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCenter, setUserCenter] = useState<[number, number] | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [routeLine, setRouteLine] = useState<{ from: [number, number]; to: [number, number]; mode: TravelMode } | null>(null);
  const density = useDensity();
  useDensityOverlay({ map: mapInstance, view: density.view, grid: density.grid });
  useRadarOverlay({ map: mapInstance, view: density.view, radar: density.radar });

  const weatherLayer = useWeatherLayer();
  const [viewportBounds, setViewportBounds] = useState<LatLngBounds | null>(null);
  const weatherMap = useWeatherMap({ bounds: viewportBounds, enabled: weatherLayer.active });
  useTemperatureLayer({ map: mapInstance, active: weatherLayer.active, points: weatherMap.points, bounds: weatherMap.bounds });
  const [heatBannerDismissed, setHeatBannerDismissed] = useState(false);
  const heatAlert = weatherLayer.active ? weatherLayer.current?.heatAlert : null;

  useEffect(() => {
    // Only track the viewport while the layer is actually visible — no
    // reason to listen for pans/zooms nobody will see the effect of.
    if (!mapInstance || !weatherLayer.active) return;

    const readBounds = (): LatLngBounds => {
      const b = mapInstance.getBounds();
      return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewportBounds(readBounds());

    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const onMoveEnd = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => setViewportBounds(readBounds()), VIEWPORT_DEBOUNCE_MS);
    };

    mapInstance.on('moveend', onMoveEnd);
    return () => {
      mapInstance.off('moveend', onMoveEnd);
      if (debounceId) clearTimeout(debounceId);
    };
  }, [mapInstance, weatherLayer.active]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCenter([pos.coords.longitude, pos.coords.latitude]),
      () => {
        // Denied or unavailable — silently keep the Twin Cities default view.
      },
    );
  }, []);

  useEffect(() => {
    // A newly-issued alert should show even if the last one was dismissed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeatBannerDismissed(false);
  }, [heatAlert?.headline]);

  useEffect(() => {
    // Reading a URL param to sync a one-time UI action, not a local computation.
    if (searchParams.get('drop') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDropOpen(true);
      router.replace('/');
    }
  }, [searchParams, router]);

  const refreshPublic = useCallback(async () => {
    const res = await fetch('/api/drops');
    if (!res.ok) return;
    const data: { drops: DropSummary[] } = await res.json();
    setPublicDrops(Object.fromEntries(data.drops.map((d) => [d.id, d])));
  }, []);

  const refreshMine = useCallback(async () => {
    const results = await Promise.all(
      records.map(async (r) => {
        const res = await fetch(`/api/drops/${r.dropId}`);
        if (!res.ok) return null;
        const data: { drop: DropSummary } = await res.json();
        return data.drop;
      }),
    );
    const found = results.filter((d): d is DropSummary => d !== null);
    setMyDropDetails(Object.fromEntries(found.map((d) => [d.id, d])));

    for (const r of records) {
      if (!found.some((d) => d.id === r.dropId)) remove(r.dropId);
    }
  }, [records, remove]);

  useEffect(() => {
    // Polling an external source (the live pins API), not a local computation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPublic();
    const id = setInterval(refreshPublic, POLL_MS);
    return () => clearInterval(id);
  }, [refreshPublic]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshMine();
    const id = setInterval(refreshMine, POLL_MS);
    return () => clearInterval(id);
  }, [refreshMine]);

  const combined: Record<string, DropSummary> = { ...publicDrops, ...myDropDetails };
  const drops = Object.values(combined);
  const selected = selectedId ? combined[selectedId] : null;
  const myRecord = selectedId ? byId(selectedId) : null;

  return (
    // Viewport minus the 56px header, the 32px live ticker, and (below md) the
    // 4rem bottom tab bar — the map fills exactly what's left, never scrolls.
    <div className="relative h-[calc(100vh-56px-32px-4rem-env(safe-area-inset-bottom))] w-full md:h-[calc(100vh-56px-32px)]">
      <Map
        markers={drops.map((d) => ({
          id: d.id,
          lat: d.lat,
          lng: d.lng,
          isMine: !!byId(d.id),
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          categories: d.categories,
          locationType: d.locationType,
        }))}
        onMarkerClick={setSelectedId}
        onMarkerExpire={(id) => {
          setPublicDrops((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setMyDropDetails((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          remove(id);
          expireDrop(id);
        }}
        center={userCenter ?? TWIN_CITIES_CENTER}
        // Metro-wide by default, everywhere in the US — pan to the user's
        // area once geolocation resolves, but stay zoomed out enough to see
        // their whole metro at a glance (Google Maps-style), not just a
        // Twin-Cities-specific value.
        zoom={9}
        onMapInstance={setMapInstance}
        routeLine={routeLine}
      />

      <Button
        onClick={() => setDropOpen(true)}
        className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 h-auto rounded-full bg-mn-blue px-6 py-3 text-base font-medium text-white shadow-lg hover:bg-mn-blue/90 md:inline-flex"
      >
        + Add Drop
      </Button>

      <div className="absolute left-4 top-4 z-20 flex flex-col items-start gap-2">
        <ToggleGroup
          value={[density.view]}
          onValueChange={(value) => {
            const next = value[0] as DensityView | undefined;
            if (next) density.setView(next);
          }}
          variant="outline"
          className="rounded-full bg-white/90 p-1 shadow-lg"
        >
          {(Object.keys(VIEW_LABEL) as DensityView[]).map((view) => (
            <ToggleGroupItem key={view} value={view} className="rounded-full px-3">
              {VIEW_LABEL[view]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {density.view !== 'off' && (
          <div className="flex flex-col gap-1 rounded-lg bg-white/90 px-3 py-2 text-xs text-muted-foreground shadow">
            {(density.view === 'grid' ? GRID_LEGEND : RADAR_LEGEND).map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-2 md:top-4">
        {heatAlert && !heatBannerDismissed && (
          <div className="flex max-w-[92vw] items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-800 shadow">
            <span className="truncate font-semibold">{heatAlert.event}</span>
            <Link href="/?drop=1" className="shrink-0 font-medium underline">
              + Add Drop
            </Link>
            <button
              onClick={() => setHeatBannerDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}
        {drops.length === 0 && (
          <div className="pointer-events-none rounded-full bg-white/90 px-4 py-1.5 text-sm text-muted-foreground shadow">
            No active pickups right now
          </div>
        )}
      </div>

      {weatherLayer.active && (
        <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-1 rounded-lg bg-white/90 px-3 py-2 text-xs text-muted-foreground shadow">
          <span className="font-medium text-slate-700">Temperature</span>
          <div
            className="h-2 w-40 rounded-full"
            style={{ background: `linear-gradient(to right, ${TEMPERATURE_GRADIENT_CSS})` }}
          />
          <div className="flex justify-between text-[10px]">
            <span>Cold</span>
            <span>Hot</span>
          </div>
        </div>
      )}

      <DropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        center={userCenter ?? TWIN_CITIES_CENTER}
        identity={identity}
        onDropped={(record) => {
          add(record);
          refreshPublic();
          refreshMine();
        }}
      />

      {selected && identity && (
        <DropDrawer
          drop={selected}
          identity={identity}
          myRecord={myRecord}
          userCenter={userCenter}
          onClose={() => {
            setSelectedId(null);
            setRouteLine(null);
          }}
          onClaimed={(record) => {
            add(record);
            refreshPublic();
            refreshMine();
          }}
          onCompleted={(dropId) => {
            remove(dropId);
            setSelectedId(null);
            setRouteLine(null);
            refreshPublic();
          }}
          onCancelled={(dropId) => {
            remove(dropId);
            setSelectedId(null);
            setRouteLine(null);
            refreshPublic();
          }}
          onRoute={(route) =>
            setRouteLine(route && userCenter ? { from: userCenter, to: [route.to.lng, route.to.lat], mode: route.mode } : null)
          }
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}
