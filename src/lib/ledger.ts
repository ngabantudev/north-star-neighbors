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

/**
 * Plain-language wording throughout: "drop" and "pickup" are the words the
 * rest of the app already puts in front of people (the Add Drop button, the My
 * Drops tab), while "cache", "handoff", and "transaction" were vocabulary only
 * this feature used. A neighbor reading the feed shouldn't have to learn a
 * second name for the thing they just did.
 */
export const LEDGER_EVENT_VERB: Record<LedgerEventType, string> = {
  DROPPED: 'added a drop',
  CLAIMED: 'claimed a drop',
  FULFILLED: 'completed a pickup',
  CANCELED: 'cancelled a drop',
  EXPIRED: 'removed an expired drop',
};

export const LEDGER_EVENT_LABEL: Record<LedgerEventType, string> = {
  DROPPED: 'Drop added',
  CLAIMED: 'Drop claimed',
  FULFILLED: 'Pickup completed',
  CANCELED: 'Drop cancelled',
  EXPIRED: 'Drop expired',
};

/**
 * Accent color per event — the notification chips, the ledger rows, and the
 * drawer all key off this one map, so the feature reads as a single system.
 * Drawn from the mn.gov palette the rest of the app is matched to (see the
 * @theme block in globals.css) rather than a generic status ramp: new supply
 * is the logo green, a claim is the link blue, a completed handoff is the
 * header navy, and the two "it's gone" outcomes are a muted state red and the
 * app's own --muted-foreground.
 */
export const LEDGER_EVENT_COLOR: Record<LedgerEventType, string> = {
  DROPPED: '#71bf43', // mn-green
  CLAIMED: '#0062b2', // mn-sky
  FULFILLED: '#003865', // mn-blue
  CANCELED: '#b3272d',
  EXPIRED: '#5b6b76', // --muted-foreground
};

/**
 * Reserved non-user actors written by actions.ts: cancellations are recorded
 * without attributing them to either party (provider and claimant can both
 * cancel, and saying which one did would leak who held the pin), and expiry
 * is the database sweeping up after itself.
 */
const RESERVED_ACTOR_LABELS: Record<string, string> = {
  anonymous: 'A neighbor',
  system: 'Automatic cleanup',
};

export function ledgerActorLabel(handle: string): string {
  return RESERVED_ACTOR_LABELS[handle] ?? handle;
}

/** True when the actor is a real pseudonymous handle worth rendering an avatar for. */
export function isHandleActor(handle: string): boolean {
  return !(handle in RESERVED_ACTOR_LABELS);
}

/** What the public is allowed to know about where a drop happened. */
export function ledgerZoneLabel(entry: Pick<LedgerEntry, 'anchorName' | 'locationType'>): string {
  if (entry.anchorName) return entry.anchorName;
  if (entry.locationType === 'curbside') return 'Curbside — street kept private';
  return 'Location not shared';
}

/**
 * "12:03:45 PM" in the reader's own timezone. Seconds are as fine-grained as
 * this ever needs to be — nobody reading a neighborhood feed is distinguishing
 * two events by their milliseconds.
 */
export function formatLedgerClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "Jul 27" — the feed spans at most 24h, so the year is never useful. */
export function formatLedgerDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
