import { sql } from '@/lib/db';
import {
  LEDGER_WINDOW_HOURS,
  PUBLIC_LEDGER_EVENTS,
  type LedgerEntry,
  type LedgerEventType,
} from '@/lib/ledger';
import type { DropCategory, DropLocationType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LedgerRow = {
  id: string;
  event_type: LedgerEventType;
  actor_handle: string;
  anchor_name: string | null;
  location_type: DropLocationType | null;
  categories: DropCategory[] | null;
  details_fingerprint: string | null;
  drop_id: string;
  occurred_at: string;
};

function toEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    eventType: row.event_type,
    actorHandle: row.actor_handle,
    anchorName: row.anchor_name,
    locationType: row.location_type,
    categories: row.categories ?? [],
    detailsFingerprint: row.details_fingerprint,
    dropId: row.drop_id,
    occurredAt: row.occurred_at,
  };
}

/**
 * Keyset cursor over the feed's (occurred_at desc, id desc) ordering.
 * Timestamps alone tie — two events inside the same millisecond would silently
 * drop a row from the next page — so the row id is part of the cursor.
 */
function parseCursor(raw: string | null): { ts: string; id: string } | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf('|');
  if (separator <= 0) return null;
  const ts = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (Number.isNaN(Date.parse(ts)) || !/^\d+$/.test(id)) return null;
  return { ts, id };
}

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/**
 * The public transaction ledger.
 *
 * Everything returned here is already public or deliberately coarsened:
 *  - `anchor_name` is a pre-approved civic site that the map shows anyway;
 *    curbside events return null and render as "masked curbside block", so a
 *    residential drop is never resolvable to a street from the ledger.
 *  - `details_hash` is truncated to 12 hex chars. It exists to prove a drop
 *    was described a certain way, not to be reversed — and a 140-char field
 *    full of predictable phrases ("winter coats, size L") would be trivially
 *    dictionary-attackable if the full digest were published.
 *  - `drop_id` is the same id `/api/drops` already publishes for live pins,
 *    and resolves to nothing once a drop is completed, canceled, or expired.
 *  - Token hashes, plaintext details, photos, and exact coordinates are never
 *    written to the ledger in the first place (see writeLedger in actions.ts).
 *
 * Query params: `limit`, `cursor`, `event` (one PUBLIC_LEDGER_EVENTS value),
 * `dropId` (the full event chain for one drop, for the drill-down drawer).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const limit = parseLimit(params.get('limit'));
  const cursor = parseCursor(params.get('cursor'));

  const rawEvent = params.get('event');
  if (rawEvent && !PUBLIC_LEDGER_EVENTS.includes(rawEvent as LedgerEventType)) {
    return Response.json({ error: 'Unknown event type.' }, { status: 400 });
  }
  const eventFilter = rawEvent ?? null;

  const rawDropId = params.get('dropId');
  if (rawDropId && !UUID_RE.test(rawDropId)) {
    return Response.json({ error: 'Invalid drop reference.' }, { status: 400 });
  }
  const dropId = rawDropId ?? null;

  const rows = await sql`
    select
      al.id::text as id,
      al.event_type,
      al.actor_handle,
      al.anchor_name,
      al.location_type,
      al.categories,
      left(al.details_hash, 12) as details_fingerprint,
      al.drop_id::text as drop_id,
      -- Formatted server-side rather than handed to the driver's date parser,
      -- so the millisecond precision the ticker renders is guaranteed.
      to_char(al.occurred_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as occurred_at
    from activity_ledger al
    where al.occurred_at > now() - make_interval(hours => ${LEDGER_WINDOW_HOURS})
      and al.event_type = any(${PUBLIC_LEDGER_EVENTS as readonly string[]}::text[])
      and (${eventFilter}::text is null or al.event_type = ${eventFilter}::text)
      and (${dropId}::uuid is null or al.drop_id = ${dropId}::uuid)
      and (
        ${cursor?.ts ?? null}::timestamptz is null
        or (al.occurred_at, al.id) < (${cursor?.ts ?? null}::timestamptz, ${cursor?.id ?? null}::bigint)
      )
    order by al.occurred_at desc, al.id desc
    limit ${limit}
  `;

  const entries = (rows as LedgerRow[]).map(toEntry);
  const last = entries.at(-1);
  const nextCursor = last && entries.length === limit ? `${last.occurredAt}|${last.id}` : null;

  return Response.json({ entries, nextCursor, windowHours: LEDGER_WINDOW_HOURS });
}
