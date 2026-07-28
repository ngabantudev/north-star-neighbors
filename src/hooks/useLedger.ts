'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerEntry, LedgerEventType } from '@/lib/ledger';

const DEFAULT_POLL_MS = 8000;
const DEFAULT_LIMIT = 40;
/** Ceiling on how much of the feed one client keeps in memory. */
const MAX_ENTRIES = 300;

interface UseLedgerOptions {
  limit?: number;
  /** Restrict to a single event type. Changing it refetches from the top. */
  eventType?: LedgerEventType | null;
  /** Only the event chain for this drop (the drill-down view). Disables polling. */
  dropId?: string;
  pollMs?: number;
}

interface LedgerState {
  entries: LedgerEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** Null once the feed has been read to the end of the retention window. */
  nextCursor: string | null;
  loadMore: () => void;
}

interface LedgerResponse {
  entries: LedgerEntry[];
  nextCursor: string | null;
}

/** Newest first, tie-broken by row id so same-millisecond events stay stable. */
function byRecency(a: LedgerEntry, b: LedgerEntry): number {
  if (a.occurredAt !== b.occurredAt) return b.occurredAt.localeCompare(a.occurredAt);
  return Number(b.id) - Number(a.id);
}

function merge(previous: LedgerEntry[], incoming: LedgerEntry[]): LedgerEntry[] {
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort(byRecency).slice(0, MAX_ENTRIES);
}

/**
 * Reads the public transaction ledger. Polling refetches only the first page
 * and merges it in by row id, so new activity streams in at the top without
 * throwing away pages the reader already scrolled through.
 */
export function useLedger(options: UseLedgerOptions = {}): LedgerState {
  const { limit = DEFAULT_LIMIT, eventType = null, dropId, pollMs = DEFAULT_POLL_MS } = options;

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Guards against a slow `loadMore` response landing after the filter changed
  // and re-seeding the list with rows from the previous query.
  const requestIdRef = useRef(0);

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (eventType) params.set('event', eventType);
      if (dropId) params.set('dropId', dropId);
      if (cursor) params.set('cursor', cursor);
      return `/api/ledger?${params}`;
    },
    [limit, eventType, dropId],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    // Filters changed — drop the old page set rather than merging across it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries([]);
    setNextCursor(null);
    setLoading(true);

    const fetchHead = async () => {
      try {
        const res = await fetch(buildUrl());
        if (cancelled || requestId !== requestIdRef.current) return;
        if (!res.ok) throw new Error('Could not load the ledger.');
        const data: LedgerResponse = await res.json();
        if (cancelled || requestId !== requestIdRef.current) return;
        setEntries((previous) => merge(previous, data.entries));
        // Only the first read establishes the cursor; later polls re-read the
        // same head page and must not rewind pagination the reader advanced.
        setNextCursor((previous) => previous ?? data.nextCursor);
        setError(null);
      } catch (e: unknown) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : 'Could not load the ledger.');
      } finally {
        if (!cancelled && requestId === requestIdRef.current) setLoading(false);
      }
    };

    fetchHead();
    // A drill-down chain is a closed set of past events — nothing to poll for.
    if (dropId) return () => { cancelled = true; };

    const id = setInterval(fetchHead, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [buildUrl, dropId, pollMs]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    (async () => {
      try {
        const res = await fetch(buildUrl(nextCursor));
        if (requestId !== requestIdRef.current) return;
        if (!res.ok) throw new Error('Could not load more of the ledger.');
        const data: LedgerResponse = await res.json();
        if (requestId !== requestIdRef.current) return;
        setEntries((previous) => merge(previous, data.entries));
        setNextCursor(data.nextCursor);
      } catch (e: unknown) {
        if (requestId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : 'Could not load more of the ledger.');
      } finally {
        if (requestId === requestIdRef.current) setLoadingMore(false);
      }
    })();
  }, [buildUrl, nextCursor, loadingMore]);

  return { entries, loading, loadingMore, error, nextCursor, loadMore };
}
