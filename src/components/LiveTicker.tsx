'use client';

import { useState } from 'react';
import Link from 'next/link';
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

/** How many of the newest events ride the marquee. */
const TICKER_SIZE = 18;
/** Seconds of scroll per item — keeps a short feed from whipping past. */
const SECONDS_PER_ITEM = 6;
const MIN_DURATION_SECONDS = 30;

function TickerItem({ entry, onSelect }: { entry: LedgerEntry; onSelect: (entry: LedgerEntry) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-slate-300 transition-colors hover:text-white"
    >
      <span className="font-mono tabular-nums text-slate-500">{formatLedgerClock(entry.occurredAt)}</span>
      <span
        className="size-1.5 rounded-full"
        style={{ background: LEDGER_EVENT_COLOR[entry.eventType] }}
        aria-hidden="true"
      />
      <span className="font-medium text-white">{ledgerActorLabel(entry.actorHandle)}</span>
      <span>{LEDGER_EVENT_VERB[entry.eventType]}</span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-400">{ledgerZoneLabel(entry)}</span>
    </button>
  );
}

/**
 * App-wide activity ticker: a continuously scrolling marquee of the newest
 * public ledger events, at the millisecond precision the ledger records them.
 * Rendered as a fixed-height strip under the header on every page, so the
 * layout height is stable whether or not there's activity to show.
 *
 * The marquee holds two identical copies of the list and translates by -50%,
 * which loops seamlessly; the second copy is aria-hidden so screen readers
 * see each event once. Motion is paused on hover and disabled entirely under
 * prefers-reduced-motion, where the strip falls back to a scrollable row.
 */
export function LiveTicker() {
  const { entries } = useLedger({ limit: TICKER_SIZE });
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  const items = entries.slice(0, TICKER_SIZE);
  const durationSeconds = Math.max(MIN_DURATION_SECONDS, items.length * SECONDS_PER_ITEM);

  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900 pl-2 text-[11px]">
        <Link
          href="/ledger"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 font-semibold uppercase tracking-wider text-mn-green transition-colors hover:bg-slate-700"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-mn-green" aria-hidden="true" />
          Live
        </Link>

        {/* aria-live off: a perpetually-scrolling feed announced on every poll
            would make the rest of the app unusable. /ledger is the readable one. */}
        <div
          className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)] motion-reduce:overflow-x-auto"
          aria-live="off"
        >
          {items.length === 0 ? (
            <span className="px-1 text-slate-500">Waiting on community activity…</span>
          ) : (
            <div className="nsn-marquee flex w-max items-center" style={{ animationDuration: `${durationSeconds}s` }}>
              {[0, 1].map((copy) => (
                <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
                  {items.map((entry) => (
                    <TickerItem key={entry.id} entry={entry} onSelect={setSelected} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && <LedgerDrawer entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
