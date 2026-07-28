'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DropSummary, TravelMode } from '@/lib/types';
import { DROP_CATEGORY_LABELS, DROP_LOCATION_LABEL, TRAVEL_MODE_LABELS, CURBSIDE_SIGNPOST } from '@/lib/types';
import type { Identity } from '@/hooks/useIdentity';
import { claimDrop, completeDrop, flagDrop, cancelDrop, getExactLocation } from '@/app/actions';
import { AvatarBadge } from '@/components/AvatarBadge';
import { formatCountdown } from '@/lib/time';
import { formatDistance, osmDirectionsUrl } from '@/lib/distance';
import { estimateEtaMinutes, haversineMeters } from '@/lib/routing';

export interface MyDropRecord {
  dropId: string;
  token: string;
  role: 'provider' | 'claimant';
}

interface RouteRequest {
  to: { lat: number; lng: number };
  mode: TravelMode;
}

interface DropDrawerProps {
  drop: DropSummary;
  identity: Identity;
  myRecord: MyDropRecord | null;
  /** [lng, lat] — the browser's own last-known position, reused (no fresh sensor read here). */
  userCenter: [number, number] | null;
  onClose: () => void;
  onClaimed: (record: MyDropRecord) => void;
  onCompleted: (dropId: string) => void;
  onCancelled: (dropId: string) => void;
  /** Draws (or clears, with null) the instant-routing line on the parent's map. */
  onRoute: (route: RouteRequest | null) => void;
}

export function DropDrawer({
  drop,
  identity,
  myRecord,
  userCenter,
  onClose,
  onClaimed,
  onCompleted,
  onCancelled,
  onRoute,
}: DropDrawerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [remaining, setRemaining] = useState(() => new Date(drop.expiresAt).getTime() - Date.now());
  const [route, setRoute] = useState<RouteRequest | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(new Date(drop.expiresAt).getTime() - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [drop.expiresAt]);

  // Clear the drawn route the moment this drop stops being the selected one.
  useEffect(() => {
    return () => onRoute(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop.id]);

  function handleSelectMode(mode: TravelMode) {
    if (!myRecord) return;
    setRouteError(null);
    startTransition(async () => {
      const result = await getExactLocation({ dropId: drop.id, token: myRecord.token });
      if (!result.ok) {
        setRouteError(result.error);
        return;
      }
      const next = { to: result.data, mode };
      setRoute(next);
      onRoute(next);
    });
  }

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      // Reuse the persistent identity token (not a fresh one) so ownership
      // and the reputation row both key off the same hash.
      const claimantToken = identity.token;
      const result = await claimDrop({
        dropId: drop.id,
        claimantHandle: identity.handle,
        claimantToken,
        deviceHash: identity.deviceId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClaimed({ dropId: drop.id, token: claimantToken, role: 'claimant' });
    });
  }

  function handleComplete(positiveRating: boolean) {
    if (!myRecord) return;
    setError(null);
    startTransition(async () => {
      const result = await completeDrop({
        dropId: drop.id,
        token: myRecord.token,
        positiveRating,
        deviceHash: identity.deviceId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCompleted(drop.id);
    });
  }

  function handleCancel() {
    if (!myRecord) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelDrop({ dropId: drop.id, token: myRecord.token, deviceHash: identity.deviceId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCancelled(drop.id);
    });
  }

  function handleFlag() {
    setError(null);
    startTransition(async () => {
      const result = await flagDrop({ dropId: drop.id, deviceHash: identity.deviceId });
      if (result.ok) setFlagged(true);
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-2xl sm:border">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{drop.anchorName ?? DROP_LOCATION_LABEL[drop.locationType]}</h2>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            {drop.locationType === 'curbside' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {CURBSIDE_SIGNPOST[drop.status === 'AVAILABLE' ? 'AVAILABLE' : 'CLAIMED']}
              </span>
            )}
            {remaining > 0 ? `${formatCountdown(remaining)} left` : 'expired'}
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          ✕
        </button>
      </div>

      {drop.hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/drops/${drop.id}/photo`}
          alt="Photo of the supplies"
          className="mb-3 h-40 w-full rounded-lg object-cover ring-1 ring-slate-200"
        />
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {drop.categories.map((c) => (
          <span key={c} className="rounded-full bg-mn-sky/10 px-2.5 py-0.5 text-xs font-medium text-mn-sky">
            {DROP_CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>

      {drop.details && <p className="mb-3 text-sm text-slate-700">{drop.details}</p>}

      {drop.status === 'CLAIMED' && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Go to {drop.anchorName ?? 'the curbside pickup point'}.</p>
          <p className="flex items-center gap-1">
            Pickup claimed by {drop.claimantHandle ? <AvatarBadge label={drop.claimantHandle} /> : 'Anonymous'}.
          </p>
        </div>
      )}

      {myRecord?.role === 'claimant' && drop.status === 'CLAIMED' && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Get there — pick how you&apos;re heading over</p>
          <div className="flex gap-1.5">
            {(Object.keys(TRAVEL_MODE_LABELS) as TravelMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSelectMode(mode)}
                disabled={pending}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm disabled:opacity-50 ${
                  route?.mode === mode ? 'border-mn-blue bg-mn-blue/10 font-medium text-mn-blue' : 'border-slate-200 text-slate-600'
                }`}
              >
                {TRAVEL_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          {routeError && <p className="mt-2 text-xs text-red-600">{routeError}</p>}
          {route && userCenter && (
            <div className="mt-2 text-xs text-slate-500">
              {(() => {
                const meters = haversineMeters(userCenter[1], userCenter[0], route.to.lat, route.to.lng);
                return (
                  <p>
                    ≈{formatDistance(meters)} · ~{estimateEtaMinutes(meters, route.mode)} min ·{' '}
                    <a
                      href={osmDirectionsUrl(route.to.lat, route.to.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Open full directions
                    </a>
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {!myRecord && drop.status === 'AVAILABLE' && (
          <button
            onClick={handleClaim}
            disabled={pending}
            className="rounded-lg bg-mn-blue px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Claiming…' : 'Claim Pickup'}
          </button>
        )}

        {myRecord && drop.status === 'CLAIMED' && !showRating && (
          <button
            onClick={() => setShowRating(true)}
            disabled={pending}
            className="rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            Complete / Handoff Done
          </button>
        )}

        {myRecord && showRating && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm text-slate-600">How did the handoff go?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleComplete(true)}
                disabled={pending}
                className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-white disabled:opacity-50"
              >
                👍 Good
              </button>
              <button
                onClick={() => handleComplete(false)}
                disabled={pending}
                className="flex-1 rounded-lg bg-slate-600 px-3 py-2 text-white disabled:opacity-50"
              >
                👎 Issue
              </button>
            </div>
          </div>
        )}

        {myRecord && (
          <button
            onClick={handleCancel}
            disabled={pending}
            className="rounded-lg border border-red-300 px-4 py-2.5 font-medium text-red-600 disabled:opacity-50"
          >
            Cancel &amp; Alert
          </button>
        )}

        {!myRecord && (
          <button
            onClick={handleFlag}
            disabled={pending || flagged}
            className="text-xs text-slate-400 underline hover:text-slate-600 disabled:no-underline"
          >
            {flagged ? 'Reported — thank you' : 'Report / Invalid Pin'}
          </button>
        )}
      </div>
    </div>
  );
}
