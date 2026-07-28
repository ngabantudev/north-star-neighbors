'use client';

import { AvatarBadge } from '@/components/AvatarBadge';
import { useLedger } from '@/hooks/useLedger';
import {
  LEDGER_EVENT_COLOR,
  LEDGER_EVENT_LABEL,
  formatLedgerClock,
  formatLedgerDate,
  isHandleActor,
  ledgerActorLabel,
  ledgerZoneLabel,
  type LedgerEntry,
} from '@/lib/ledger';
import { DROP_CATEGORY_LABELS, DROP_LOCATION_LABEL } from '@/lib/types';

interface LedgerDrawerProps {
  entry: LedgerEntry;
  onClose: () => void;
}

function EventDot({ eventType }: { eventType: LedgerEntry['eventType'] }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: LEDGER_EVENT_COLOR[eventType] }}
      aria-hidden="true"
    />
  );
}

/**
 * Drill-down for one ledger row: what the public record actually says, plus
 * the rest of the event chain for the same cache. Deliberately shows the
 * withheld fields as withheld rather than omitting them — a transparency log
 * that quietly drops the private parts reads as if there weren't any.
 */
export function LedgerDrawer({ entry, onClose }: LedgerDrawerProps) {
  const chain = useLedger({ dropId: entry.dropId, limit: 50 });
  const zone = ledgerZoneLabel(entry);
  const isCurbside = entry.locationType === 'curbside';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:rounded-2xl sm:border">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <EventDot eventType={entry.eventType} />
            <h2 className="text-lg font-semibold text-slate-900">{LEDGER_EVENT_LABEL[entry.eventType]}</h2>
          </div>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
            {formatLedgerDate(entry.occurredAt)} · {formatLedgerClock(entry.occurredAt)}
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          ✕
        </button>
      </div>

      <dl className="mb-4 flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Actor</dt>
          <dd className="mt-0.5 text-slate-800">
            {isHandleActor(entry.actorHandle) ? (
              <AvatarBadge label={entry.actorHandle} />
            ) : (
              ledgerActorLabel(entry.actorHandle)
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Zone</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-800">
            {zone}
            {entry.locationType && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {DROP_LOCATION_LABEL[entry.locationType]}
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Categories</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {entry.categories.length === 0 ? (
              <span className="text-slate-400">Not recorded</span>
            ) : (
              entry.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-mn-sky/10 px-2.5 py-0.5 text-xs font-medium text-mn-sky"
                >
                  {DROP_CATEGORY_LABELS[category]}
                </span>
              ))
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Cache reference</dt>
          <dd className="mt-0.5 font-mono text-xs text-slate-600">
            {entry.dropId.slice(0, 8)}
            {entry.detailsFingerprint && (
              <>
                {' · '}
                <span title="Truncated SHA-256 of the drop's description">sha {entry.detailsFingerprint}</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        {isCurbside ? (
          <>
            This was a curbside cache. The ledger records <span className="font-medium">that</span> it happened, never
            where — the street, the block, and the household stay off the public record entirely.
          </>
        ) : (
          <>
            Public civic sites are named because they are already public. Descriptions are stored only as a one-way
            hash, and photos, coordinates, and ownership tokens never reach the ledger at all.
          </>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Chain for this cache</h3>
        {chain.loading && <p className="text-sm text-slate-400">Loading…</p>}
        {chain.error && <p className="text-sm text-red-600">{chain.error}</p>}
        {!chain.loading && !chain.error && (
          <ol className="flex flex-col gap-1.5">
            {chain.entries.map((event) => (
              <li
                key={event.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                  event.id === entry.id ? 'bg-mn-sky/10 font-medium text-slate-900' : 'text-slate-600'
                }`}
              >
                <EventDot eventType={event.eventType} />
                <span className="font-mono tabular-nums text-slate-500">{formatLedgerClock(event.occurredAt)}</span>
                <span className="truncate">{LEDGER_EVENT_LABEL[event.eventType]}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
