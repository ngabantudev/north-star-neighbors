import type { DropCategory, DropLocationType } from '@/lib/types';

/**
 * Events the public ledger is allowed to surface. FLAGGED and HIDDEN are
 * deliberately absent: publishing moderation signals in real time tells a
 * bad actor exactly how close their pin is to the auto-hide threshold, and
 * tells everyone else which neighbor got reported. They stay in the
 * append-only table for the abuse-mitigation path, just not on the feed.
 */
export const PUBLIC_LEDGER_EVENTS = ['DROPPED', 'CLAIMED', 'FULFILLED', 'CANCELED', 'EXPIRED'] as const;

export type LedgerEventType = (typeof PUBLIC_LEDGER_EVENTS)[number];

/** Rolling window the feed reads — matches the retention trigger in db/migrations/006_public_ledger.sql. */
export const LEDGER_WINDOW_HOURS = 24;

/**
 * One public ledger row. Everything here is either already visible on the
 * public map or deliberately coarsened — never an exact curbside coordinate,
 * never plaintext details, never a token hash.
 */
export interface LedgerEntry {
  id: string;
  eventType: LedgerEventType;
  /** Pseudonymous handle, or the reserved 'anonymous' / 'system' actors. */
  actorHandle: string;
  /** Public civic site name for anchor drops; null for curbside (masked). */
  anchorName: string | null;
  locationType: DropLocationType | null;
  categories: DropCategory[];
  /** First 12 hex chars of the SHA-256 of the drop's details — see the API route. */
  detailsFingerprint: string | null;
  dropId: string;
  /** ISO-8601 UTC with millisecond precision, e.g. "2026-07-27T17:03:45.892Z". */
  occurredAt: string;
}

export const LEDGER_EVENT_VERB: Record<LedgerEventType, string> = {
  DROPPED: 'logged a drop',
  CLAIMED: 'claimed a cache',
  FULFILLED: 'confirmed a handoff',
  CANCELED: 'pulled a cache',
  EXPIRED: 'let a cache time out',
};

export const LEDGER_EVENT_LABEL: Record<LedgerEventType, string> = {
  DROPPED: 'Drop logged',
  CLAIMED: 'Cache claimed',
  FULFILLED: 'Handoff confirmed',
  CANCELED: 'Cache pulled',
  EXPIRED: 'Cache expired',
};

/** Dot/chip color per event, shared by the ticker and the ledger page. */
export const LEDGER_EVENT_COLOR: Record<LedgerEventType, string> = {
  DROPPED: '#71bf43',
  CLAIMED: '#0062b2',
  FULFILLED: '#16a34a',
  CANCELED: '#e11d48',
  EXPIRED: '#94a3b8',
};

/**
 * Reserved non-user actors written by actions.ts: cancellations are recorded
 * without attributing them to either party (provider and claimant can both
 * cancel, and saying which one did would leak who held the pin), and expiry
 * is the database sweeping up after itself.
 */
const RESERVED_ACTOR_LABELS: Record<string, string> = {
  anonymous: 'A neighbor',
  system: 'Auto-sweep',
};

export function ledgerActorLabel(handle: string): string {
  return RESERVED_ACTOR_LABELS[handle] ?? handle;
}

/** True when the actor is a real pseudonymous handle worth rendering an avatar for. */
export function isHandleActor(handle: string): boolean {
  return !(handle in RESERVED_ACTOR_LABELS);
}

/** What the public is allowed to know about where a transaction happened. */
export function ledgerZoneLabel(entry: Pick<LedgerEntry, 'anchorName' | 'locationType'>): string {
  if (entry.anchorName) return entry.anchorName;
  if (entry.locationType === 'curbside') return 'Masked curbside block';
  return 'Undisclosed zone';
}

/**
 * "12:03:45.892 PM" in the reader's own timezone. Built by splicing the
 * milliseconds into the localized time string rather than hand-assembling it,
 * so 24-hour locales and the narrow no-break space some ICU versions put
 * before AM/PM both still come out right.
 */
export function formatLedgerClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--.---';
  const localized = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return localized.replace(/(\d{1,2}:\d{2}:\d{2})/, `$1.${millis}`);
}

/** "Jul 27" — the feed spans at most 24h, so the year is never useful. */
export function formatLedgerDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
