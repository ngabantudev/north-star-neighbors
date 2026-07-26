'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map, TWIN_CITIES_CENTER } from '@/components/Map';
import { DropDrawer } from '@/components/DropDrawer';
import { DropDialog } from '@/components/DropDialog';
import { Button } from '@/components/ui/button';
import { useIdentity } from '@/hooks/useIdentity';
import { useMyDrops } from '@/hooks/useMyDrops';
import { expireDrop } from '@/app/actions';
import type { DropSummary } from '@/lib/types';

const POLL_MS = 6000;

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
    <div className="relative h-[calc(100vh-56px)] w-full">
      <Map
        markers={drops.map((d) => ({
          id: d.id,
          lat: d.lat,
          lng: d.lng,
          isMine: !!byId(d.id),
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          categories: d.categories,
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
        zoom={userCenter ? 13 : 11}
      />

      <Button
        onClick={() => setDropOpen(true)}
        className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 h-auto rounded-full bg-mn-blue px-6 py-3 text-base font-medium text-white shadow-lg hover:bg-mn-blue/90"
      >
        + Add Drop
      </Button>

      {drops.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm text-muted-foreground shadow">
          No active pickups right now
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
          onClose={() => setSelectedId(null)}
          onClaimed={(record) => {
            add(record);
            refreshPublic();
            refreshMine();
          }}
          onCompleted={(dropId) => {
            remove(dropId);
            setSelectedId(null);
            refreshPublic();
          }}
          onCancelled={(dropId) => {
            remove(dropId);
            setSelectedId(null);
            refreshPublic();
          }}
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
