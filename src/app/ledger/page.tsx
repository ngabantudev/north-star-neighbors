'use client';

import { useState } from 'react';
import { AvatarBadge } from '@/components/AvatarBadge';
import { LedgerDrawer } from '@/components/LedgerDrawer';
import { useLedger } from '@/hooks/useLedger';
import {
  LEDGER_EVENT_COLOR,
  LEDGER_EVENT_LABEL,
  LEDGER_WINDOW_HOURS,
  PUBLIC_LEDGER_EVENTS,
  formatLedgerClock,
  formatLedgerDate,
  isHandleActor,
  ledgerActorLabel,
  ledgerZoneLabel,
  type LedgerEntry,
  type LedgerEventType,
} from '@/lib/ledger';
import { DROP_CATEGORY_LABELS } from '@/lib/types';

const FILTERS: { label: string; value: LedgerEventType | null }[] = [
  { label: 'All activity', value: null },
  ...PUBLIC_LEDGER_EVENTS.map((event) => ({ label: LEDGER_EVENT_LABEL[event], value: event })),
];

function LedgerRow({ entry, onSelect }: { entry: LedgerEntry; onSelect: (entry: LedgerEntry) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-mn-sky/40 hover:bg-slate-50"
      >
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ background: LEDGER_EVENT_COLOR[entry.eventType] }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {formatLedgerClock(entry.occurredAt)}
            </span>
            <span className="text-sm font-medium text-slate-900">{LEDGER_EVENT_LABEL[entry.eventType]}</span>
            <span className="text-xs text-slate-400">{formatLedgerDate(entry.occurredAt)}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            {isHandleActor(entry.actorHandle) ? (
              <AvatarBadge label={entry.actorHandle} />
            ) : (
              <span>{ledgerActorLabel(entry.actorHandle)}</span>
            )}
            <span className="text-slate-300">·</span>
            <span>{ledgerZoneLabel(entry)}</span>
          </span>
          {entry.categories.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-mn-sky/10 px-2 py-0.5 text-[11px] font-medium text-mn-sky"
                >
                  {DROP_CATEGORY_LABELS[category]}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * The public transaction ledger: every state transition the community has
 * made in the last {LEDGER_WINDOW_HOURS} hours, readable by anyone, with no
 * account and nothing to sign in to. Rows open a drill-down drawer.
 */
export default function LedgerPage() {
  const [filter, setFilter] = useState<LedgerEventType | null>(null);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const { entries, loading, loadingMore, error, nextCursor, loadMore } = useLedger({ eventType: filter });

  return (
    <div className="mx-auto w-full max-w-2xl p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-6">
      <h1 className="mb-1 text-xl font-semibold text-mn-blue">Public ledger</h1>
      <p className="mb-4 text-sm text-slate-500">
        Every drop, claim, and handoff in the last {LEDGER_WINDOW_HOURS} hours. Pseudonymous handles and public zones
        only — no names, no addresses, no way to trace a curbside cache to a household. Entries clear themselves on the
        same {LEDGER_WINDOW_HOURS}-hour cycle as the map.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active ? 'border-mn-blue bg-mn-blue text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && entries.length === 0 && <p className="text-sm text-slate-400">Reading the ledger…</p>}
      {!loading && entries.length === 0 && !error && (
        <p className="text-sm text-slate-400">Nothing recorded in this window yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <LedgerRow key={entry.id} entry={entry} onSelect={setSelected} />
        ))}
      </ul>

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load older entries'}
        </button>
      )}

      {selected && <LedgerDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
