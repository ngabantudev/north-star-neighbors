'use client';

import { useEffect, useState } from 'react';
import type { LegislationPayload, LegislatorsPayload } from '@/lib/legislation';
import { useGeolocatedCoords } from '@/hooks/useGeolocatedCoords';

interface CampaignState {
  legislation: LegislationPayload | null;
  legislators: LegislatorsPayload | null;
  loading: boolean;
}

/**
 * Loads the statewide campaign targets: tracked bills (location-independent)
 * plus the visitor's own state legislators (from their coordinates, falling
 * back to the Twin Cities server-side when geolocation is denied).
 *
 * Fetched once per mount and never polled — a bill's status moves on the
 * order of days, and the route handler behind it is cached for six hours
 * anyway, so an interval would only burn the Open States daily quota.
 */
export function useCampaign(enabled: boolean): CampaignState {
  const [legislation, setLegislation] = useState<LegislationPayload | null>(null);
  const [legislators, setLegislators] = useState<LegislatorsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const { coords, resolved } = useGeolocatedCoords();

  useEffect(() => {
    if (!enabled || !resolved) return;
    let cancelled = false;
    const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';

    const load = async () => {
      setLoading(true);
      const [bills, reps] = await Promise.all([
        fetch('/api/legislation').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/legislators${query}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      setLegislation(bills);
      setLegislators(reps);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, resolved, coords]);

  return { legislation, legislators, loading };
}
