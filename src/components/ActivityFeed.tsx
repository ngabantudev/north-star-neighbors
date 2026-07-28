'use client';

import { useState } from 'react';
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
const POLL_MS = 5000;

function ActivityRow({ entry, onSelect }: { entry: LedgerEntry; onSelect: (entry: LedgerEntry) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      style={{ borderLeftColor: LEDGER_EVENT_COLOR[entry.eventType] }}
      // Left accent bar rather than a dot: mn.gov leans on a colored rule to
      // classify a notice, and at this size it scans faster than a 6px dot.
      className="nsn-activity pointer-events-auto block w-full rounded-md border-l-4 bg-white/90 px-2.5 py-1.5 text-left shadow-sm ring-1 ring-mn-blue/10 backdrop-blur-sm transition-colors hover:bg-white hover:ring-mn-sky/40"
    >
      <span className="block truncate text-xs text-slate-700">
        <span className="font-semibold text-mn-blue">{ledgerActorLabel(entry.actorHandle)}</span>{' '}
        {LEDGER_EVENT_VERB[entry.eventType]}
      </span>
      <span className="block truncate text-[11px] text-slate-500">
        <span className="font-mono tabular-nums">{formatLedgerClock(entry.occurredAt)}</span>
        {' · '}
        <span className="text-mn-sky">{ledgerZoneLabel(entry)}</span>
      </span>
    </button>
  );
}

/**
 * The public ledger as a standing feed in the corner of the map: the most
 * recent entries, newest first, refreshed on a poll. Clicking one opens its
 * full ledger record.
 *
 * Deliberately *not* a toast stream. An earlier version expired each row on a
 * timer and refused to backfill anything older than a few minutes, which meant
 * the corner sat empty unless a neighbor happened to act while you were
 * watching — in a metro this size, almost always. A transparency log that is
 * blank most of the time reads as broken, not as quiet. So rows persist until
 * newer ones push them out, and the only emptiness is a genuinely empty ledger.
 *
 * The container is pointer-events-none so it never blocks the map; only the
 * rows themselves are clickable. Fixed rather than in the layout flow, so no
 * page has to budget height for it.
 */
export function ActivityFeed() {
  const pathname = usePathname();
  const { entries, loading } = useLedger({ limit: MAX_VISIBLE, pollMs: POLL_MS });
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  // The ledger page already *is* this list, in full and with filters.
  if (pathname === '/ledger') return null;

  return (
    <>
      {/* Top-left of the map, clearing the h-14 site header. */}
      <div className="pointer-events-none fixed left-3 top-17 z-20 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1.5 md:left-4 md:top-18">
        {/* Solid navy + pulsing logo green — the site header's own colorway,
            so the overlay reads as part of the app and not a browser toast. */}
        <Link
          href="/ledger"
          className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-full bg-mn-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-mn-sky"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-mn-green" aria-hidden="true" />
          Live ledger
        </Link>

        {/* role=log + polite: rows arrive as discrete events, so a screen
            reader can announce them without the page fighting for focus. */}
        <div role="log" aria-live="polite" aria-label="Live community activity" className="flex flex-col gap-1.5">
          {entries.slice(0, MAX_VISIBLE).map((entry) => (
            <ActivityRow key={entry.id} entry={entry} onSelect={setSelected} />
          ))}
        </div>

        {!loading && entries.length === 0 && (
          <p className="w-fit rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-500 shadow-sm ring-1 ring-mn-blue/10 backdrop-blur-sm">
            No recorded activity yet.
          </p>
        )}
      </div>

      {selected && <LedgerDrawer entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
