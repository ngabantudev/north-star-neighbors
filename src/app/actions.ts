'use server';

import { sql } from '@/lib/db';
import { hashToken } from '@/lib/crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { queryNearbyAnchors } from '@/lib/overpass';
import { TTL_MIN_MINUTES, TTL_MAX_MINUTES, type DropCategory } from '@/lib/types';
import { createHash } from 'node:crypto';

// Widening this doesn't weaken the anti-doxxing guarantee below: whatever
// anchor gets matched, its own coordinate is what gets stored, never the
// submitter's — so this only controls how far a qualifying anchor may be,
// not how precisely someone's real position is revealed (it never is).
const ANCHOR_TOLERANCE_METERS = 500;
const FLAG_THRESHOLD = 3;
// Providers with an established, mostly-positive completion history get a
// higher bar before flags auto-hide their drop, so a handful of bad-faith
// flags can't silently take down someone with a real track record. This
// reads the reputation row that's already accumulated on every completed
// pickup (see completeDrop) — never shown in the UI, purely a server-side
// abuse-mitigation signal, and trivially reset by clearing localStorage like
// the rest of this app's identity, so it's a mild deterrent, not real
// Sybil resistance.
const TRUSTED_FLAG_THRESHOLD = 6;
const TRUST_MIN_COMPLETED = 5;
const TRUST_MAX_NEGATIVE_RATIO = 0.25;
const VALID_CATEGORIES: DropCategory[] = ['produce', 'coats', 'medical', 'water', 'baby', 'general'];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** One-way hash of drop details for the immutable ledger — proves a drop was
 *  described a certain way without exposing plaintext in the public log. */
function hashDetails(details: string): string {
  return createHash('sha256').update(details.trim()).digest('hex');
}

/** Append a row to the append-only activity ledger. Only call from inside
 *  server actions that have already validated the state transition. */
async function writeLedger(event: {
  actorHandle: string;
  eventType: 'DROPPED' | 'CLAIMED' | 'FULFILLED' | 'CANCELED' | 'FLAGGED' | 'HIDDEN' | 'EXPIRED';
  dropId: string;
  anchorName?: string;
  categories?: DropCategory[];
  details?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    insert into activity_ledger (
      actor_handle, event_type, drop_id, anchor_name, categories,
      details_hash, event_metadata
    ) values (
      ${event.actorHandle},
      ${event.eventType},
      ${event.dropId},
      ${event.anchorName ?? null},
      ${event.categories ?? null},
      ${event.details ? hashDetails(event.details) : null},
      ${event.metadata ? JSON.stringify(event.metadata) : null}::jsonb
    )
  `;
}

export async function registerIdentity(handle: string, token: string): Promise<ActionResult<null>> {
  if (!handle || handle.length > 40) return fail('Invalid handle.');
  const tokenHash = hashToken(token);
  await sql`
    insert into reputation (handle_token_hash, handle)
    values (${tokenHash}, ${handle})
    on conflict (handle_token_hash) do nothing
  `;
  return { ok: true, data: null };
}

export async function createDrop(input: {
  lat: number;
  lng: number;
  categories: DropCategory[];
  details: string;
  ttlMinutes: number;
  photo: File;
  providerHandle: string;
  providerToken: string;
  deviceHash: string;
}): Promise<ActionResult<{ dropId: string }>> {
  if (!(await checkRateLimit(input.deviceHash, 'create_drop'))) {
    return fail('Too many drops created recently. Try again later.');
  }
  if (input.ttlMinutes < TTL_MIN_MINUTES || input.ttlMinutes > TTL_MAX_MINUTES) return fail('Invalid expiry.');
  if (input.categories.length === 0 || !input.categories.every((c) => VALID_CATEGORIES.includes(c))) {
    return fail('Select at least one valid category.');
  }
  if (!input.details.trim()) return fail('Details are required.');
  if (input.details.length > 140) return fail('Details too long.');
  if (!input.photo || input.photo.size === 0) return fail('A photo is required.');
  if (input.photo.size > MAX_PHOTO_BYTES) return fail('Photo is too large.');
  if (!input.photo.type.startsWith('image/')) return fail('Invalid photo type.');

  // Never trust a client-supplied anchor identity/location claim — independently
  // re-derive the nearest real public anchor from the coordinates alone. This
  // is what makes the "must be at a real approved public site" guarantee hold
  // nationwide without a hand-curated per-region table.
  const nearby = await queryNearbyAnchors(input.lat, input.lng, ANCHOR_TOLERANCE_METERS, 1);
  const anchor = nearby[0];
  if (!anchor) return fail('Drop location is too far from any approved public site.');

  const anchorRows = await sql`
    insert into civic_anchors (osm_id, name, category, location)
    values (
      ${anchor.osmId},
      ${anchor.name},
      ${anchor.category},
      ST_SetSRID(ST_MakePoint(${anchor.lng}, ${anchor.lat}), 4326)::geography
    )
    on conflict (osm_id) do update set name = excluded.name
    returning id
  `;
  const anchorId = (anchorRows[0] as { id: string }).id;

  const tokenHash = hashToken(input.providerToken);
  const photoBuffer = Buffer.from(await input.photo.arrayBuffer());
  const rows = await sql`
    insert into drops (
      anchor_id, location, categories, details, photo, photo_content_type, expires_at,
      provider_handle, provider_token_hash
    ) values (
      ${anchorId},
      ST_SetSRID(ST_MakePoint(${anchor.lng}, ${anchor.lat}), 4326)::geography,
      ${input.categories},
      ${input.details.trim()},
      ${photoBuffer},
      ${input.photo.type},
      now() + make_interval(mins => ${input.ttlMinutes}),
      ${input.providerHandle},
      ${tokenHash}
    )
    returning id
  `;

  const dropId = (rows[0] as { id: string }).id;

  void writeLedger({
    actorHandle: input.providerHandle,
    eventType: 'DROPPED',
    dropId,
    anchorName: anchor.name,
    categories: input.categories,
    details: input.details,
    metadata: { ttlMinutes: input.ttlMinutes },
  });

  return { ok: true, data: { dropId } };
}

export async function claimDrop(input: {
  dropId: string;
  claimantHandle: string;
  claimantToken: string;
  deviceHash: string;
}): Promise<ActionResult<{ claimToken: string }>> {
  if (!(await checkRateLimit(input.deviceHash, 'claim_drop'))) {
    return fail('Too many claims recently. Try again later.');
  }

  const tokenHash = hashToken(input.claimantToken);
  const rows = await sql`
    update drops
    set status = 'CLAIMED', claimant_handle = ${input.claimantHandle},
        claimant_token_hash = ${tokenHash}, claimed_at = now()
    where id = ${input.dropId} and status = 'AVAILABLE'
    returning id
  `;

  if (rows.length === 0) return fail('This pickup was already claimed or is no longer available.');

  void writeLedger({
    actorHandle: input.claimantHandle,
    eventType: 'CLAIMED',
    dropId: input.dropId,
  });

  return { ok: true, data: { claimToken: input.claimantToken } };
}

export async function completeDrop(input: {
  dropId: string;
  token: string;
  positiveRating: boolean;
  deviceHash: string;
}): Promise<ActionResult<null>> {
  if (!(await checkRateLimit(input.deviceHash, 'complete_drop'))) {
    return fail('Too many actions recently. Try again later.');
  }

  const tokenHash = hashToken(input.token);
  const rows = await sql`
    select provider_token_hash, claimant_token_hash, provider_handle, claimant_handle
    from drops
    where id = ${input.dropId} and status = 'CLAIMED'
  `;
  if (rows.length === 0) return fail('Pickup not found or not yet claimed.');

  const drop = rows[0] as {
    provider_token_hash: string;
    claimant_token_hash: string | null;
    provider_handle: string;
    claimant_handle: string | null;
  };
  let otherPartyHash: string | null = null;
  let otherPartyHandle: string | null = null;
  if (tokenHash === drop.provider_token_hash) {
    otherPartyHash = drop.claimant_token_hash;
    otherPartyHandle = drop.claimant_handle;
  } else if (tokenHash === drop.claimant_token_hash) {
    otherPartyHash = drop.provider_token_hash;
    otherPartyHandle = drop.provider_handle;
  } else {
    return fail('Not authorized for this pickup.');
  }

  if (otherPartyHash && otherPartyHandle) {
    await sql`
      insert into reputation (handle_token_hash, handle, positive_count, negative_count, completed_count)
      values (${otherPartyHash}, ${otherPartyHandle}, ${input.positiveRating ? 1 : 0}, ${input.positiveRating ? 0 : 1}, 1)
      on conflict (handle_token_hash) do update set
        positive_count = reputation.positive_count + ${input.positiveRating ? 1 : 0},
        negative_count = reputation.negative_count + ${input.positiveRating ? 0 : 1},
        completed_count = reputation.completed_count + 1,
        updated_at = now()
    `;
  }

  const actorHandle =
    tokenHash === drop.provider_token_hash ? drop.provider_handle : drop.claimant_handle!;

  void writeLedger({
    actorHandle,
    eventType: 'FULFILLED',
    dropId: input.dropId,
    metadata: { positiveRating: input.positiveRating },
  });

  await sql`delete from drops where id = ${input.dropId}`;

  return { ok: true, data: null };
}

/** Higher flag threshold for a drop whose provider has an established,
 *  mostly-positive completion history — see the constants above. */
async function flagThresholdFor(dropId: string): Promise<number> {
  const rows = await sql`
    select r.completed_count, r.negative_count
    from drops d
    left join reputation r on r.handle_token_hash = d.provider_token_hash
    where d.id = ${dropId}
  `;
  const row = rows[0] as { completed_count: number | null; negative_count: number | null } | undefined;
  if (!row?.completed_count || row.completed_count < TRUST_MIN_COMPLETED) return FLAG_THRESHOLD;

  const negativeRatio = (row.negative_count ?? 0) / row.completed_count;
  return negativeRatio <= TRUST_MAX_NEGATIVE_RATIO ? TRUSTED_FLAG_THRESHOLD : FLAG_THRESHOLD;
}

export async function flagDrop(input: { dropId: string; deviceHash: string }): Promise<ActionResult<{ hidden: boolean }>> {
  if (!(await checkRateLimit(input.deviceHash, 'flag_drop'))) {
    return fail('Too many reports recently. Try again later.');
  }

  await sql`
    insert into flags (drop_id, device_hash) values (${input.dropId}, ${input.deviceHash})
    on conflict (drop_id, device_hash) do nothing
  `;

  const rows = await sql`select count(*)::int as count from flags where drop_id = ${input.dropId}`;
  const count = (rows[0] as { count: number }).count;

  void writeLedger({
    actorHandle: 'anonymous',
    eventType: 'FLAGGED',
    dropId: input.dropId,
    metadata: { flagCount: count },
  });

  const threshold = await flagThresholdFor(input.dropId);

  let hidden = false;
  if (count >= threshold) {
    await sql`update drops set status = 'HIDDEN' where id = ${input.dropId} and status != 'HIDDEN'`;
    void writeLedger({
      actorHandle: 'anonymous',
      eventType: 'HIDDEN',
      dropId: input.dropId,
      metadata: { flagCount: count, threshold },
    });
    hidden = true;
  }

  return { ok: true, data: { hidden } };
}

export async function cancelDrop(input: { dropId: string; token: string; deviceHash: string }): Promise<ActionResult<null>> {
  const tokenHash = hashToken(input.token);
  const rows = await sql`
    delete from drops
    where id = ${input.dropId}
      and (provider_token_hash = ${tokenHash} or claimant_token_hash = ${tokenHash})
    returning id
  `;
  if (rows.length === 0) return fail('Not authorized for this pickup.');

  void writeLedger({
    actorHandle: 'anonymous',
    eventType: 'CANCELED',
    dropId: input.dropId,
    metadata: { canceledByTokenHash: tokenHash.slice(0, 12) + '...' },
  });

  return { ok: true, data: null };
}

/**
 * Triggered client-side the instant a pin's on-map countdown hits zero, so
 * expired pins are actually purged (photo included) right away rather than
 * waiting on the periodic cron. Re-checks expiry server-side — a manipulated
 * client clock can't delete a still-live pin early.
 */
export async function expireDrop(dropId: string): Promise<ActionResult<null>> {
  const rows = await sql`delete from drops where id = ${dropId} and expires_at < now() returning id`;
  if (rows.length > 0) {
    void writeLedger({
      actorHandle: 'system',
      eventType: 'EXPIRED',
      dropId,
    });
  }
  return { ok: true, data: null };
}
