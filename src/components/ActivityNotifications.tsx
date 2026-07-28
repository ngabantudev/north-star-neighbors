'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LedgerDrawer } from '@/components/LedgerDrawer';
import { useLedger } from '@/hooks/useLedger';
import {
  LEDGER_EVENT_COLOR,
  LEDGER_EVENT_VERB,
  formatLedgerClock,
  ledgerActorLabel,
  ledgerZoneLabel,
  type LedgerEntry,
} from '@/lib/ledger';

/** Never stack more than this — the map underneath has to stay usable. */
const MAX_VISIBLE = 6;
/** How long a notification stays up before it fades itself out. */
const LIFETIME_MS = 45_000;
/** Must match the nsn-notify-out duration in globals.css. */
const EXIT_MS = 400;
const POLL_MS = 5000;
/**
 * On first load the feed is backfilled so the overlay isn't dead on arrival —
 * but only with events recent enough to still read as "just happened". A drop
 * from six hours ago announcing itself as a notification is a lie.
 */
const BACKFILL_MAX_AGE_MS = 15 * 60 * 1000;

interface Notification {
  entry: LedgerEntry;
  /** Client time we first displayed it — drives expiry, not the event's own timestamp. */
  shownAt: number;
}

function NotificationChip({ entry, onSelect }: { entry: LedgerEntry; onSelect: (entry: LedgerEntry) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      style={{ '--nsn-notify-life': `${LIFETIME_MS}ms` } as React.CSSProperties}
      className="nsn-notify pointer-events-auto flex w-full items-start gap-2 rounded-lg bg-white/75 px-2.5 py-1.5 text-left shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-white/95"
    >
      <span
        className="mt-1.5 size-1.5 shrink-0 rounded-full"
        style={{ background: LEDGER_EVENT_COLOR[entry.eventType] }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-slate-700">
          <span className="font-semibold text-slate-900">{ledgerActorLabel(entry.actorHandle)}</span>{' '}
          {LEDGER_EVENT_VERB[entry.eventType]}
        </span>
        <span className="block truncate text-[11px] text-slate-500">
          <span className="font-mono tabular-nums">{formatLedgerClock(entry.occurredAt)}</span>
          {' · '}
          {ledgerZoneLabel(entry)}
        </span>
      </span>
    </button>
  );
}

/**
 * The public ledger as a live notification stream — chat-style: transparent
 * container, translucent chips stacked oldest-to-newest in the corner, each
 * one announcing itself as it happens and fading out on its own. Nothing is
 * dismissed by hand and nothing blocks the map (the container is
 * pointer-events-none; only the chips are clickable, and clicking one opens
 * its full ledger record).
 *
 * Expiry runs off the time we *displayed* an event, not the time it happened,
 * so backfilled entries get a full lifetime on screen instead of vanishing on
 * arrival. The fade-out is a CSS animation with a delay rather than a
 * per-second re-render; state cleanup just removes the already-invisible node.
 *
 * Fixed rather than in the layout flow, so no page has to budget height for it.
 */
export function ActivityNotifications() {
  const pathname = usePathname();
  const { entries } = useLedger({ limit: 12, pollMs: POLL_MS });
  const [items, setItems] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  const seenRef = useRef<Set<string>>(new Set());
  const backfilledRef = useRef(false);

  useEffect(() => {
    const fresh = entries.filter((entry) => !seenRef.current.has(entry.id));
    if (fresh.length === 0) return;
    for (const entry of fresh) seenRef.current.add(entry.id);

    // The very first batch is history, not news — hold it to a tighter
    // freshness bar than events that arrive while someone is watching.
    const isBackfill = !backfilledRef.current;
    backfilledRef.current = true;
    const shownAt = Date.now();
    const admitted = isBackfill
      ? fresh.filter((entry) => shownAt - new Date(entry.occurredAt).getTime() < BACKFILL_MAX_AGE_MS)
      : fresh;
    if (admitted.length === 0) return;

    // `entries` is newest-first; the stack reads oldest-at-top like a chat log.
    const arriving = admitted
      .slice()
      .reverse()
      .map((entry) => ({ entry, shownAt }));

    setItems((previous) => [...previous, ...arriving].slice(-MAX_VISIBLE));
  }, [entries]);

  useEffect(() => {
    if (items.length === 0) return;
    // Only ever a no-op or a removal — the fade itself is already done in CSS,
    // so this never re-renders just to advance a clock.
    const id = setInterval(() => {
      setItems((previous) => {
        const cutoff = Date.now() - LIFETIME_MS - EXIT_MS;
        const next = previous.filter((item) => item.shownAt > cutoff);
        return next.length === previous.length ? previous : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [items.length]);

  // The ledger page already *is* this list, in full and without a timer.
  if (pathname === '/ledger') return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 z-20 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1.5 md:bottom-4 md:left-4">
        <Link
          href="/ledger"
          className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-white/95"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-mn-green" aria-hidden="true" />
          Live ledger
        </Link>

        {/* role=log + polite: these are discrete arrivals, so a screen reader
            can announce them without the page fighting for focus. */}
        <div role="log" aria-live="polite" aria-label="Live community activity" className="flex flex-col gap-1.5">
          {items.map((item) => (
            <NotificationChip key={item.entry.id} entry={item.entry} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {selected && <LedgerDrawer entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
