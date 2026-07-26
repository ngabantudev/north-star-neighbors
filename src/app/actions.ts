'use server';

import { sql } from '@/lib/db';
import { hashToken } from '@/lib/crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { queryNearbyAnchors } from '@/lib/overpass';
import type { DropCategory } from '@/lib/types';

const ANCHOR_TOLERANCE_METERS = 200;
const FLAG_THRESHOLD = 3;
// TEST VALUES (1/3 min) — see src/lib/types.ts TTL_OPTIONS for the swap-back note.
const VALID_TTL_MINUTES = [1, 3];
const VALID_CATEGORIES: DropCategory[] = ['produce', 'coats', 'medical', 'water', 'baby', 'general'];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
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
  if (!VALID_TTL_MINUTES.includes(input.ttlMinutes)) return fail('Invalid expiry.');
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

  return { ok: true, data: { dropId: (rows[0] as { id: string }).id } };
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

  await sql`delete from drops where id = ${input.dropId}`;

  return { ok: true, data: null };
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

  let hidden = false;
  if (count >= FLAG_THRESHOLD) {
    await sql`update drops set status = 'HIDDEN' where id = ${input.dropId} and status != 'HIDDEN'`;
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

  return { ok: true, data: null };
}

/**
 * Triggered client-side the instant a pin's on-map countdown hits zero, so
 * expired pins are actually purged (photo included) right away rather than
 * waiting on the periodic cron. Re-checks expiry server-side — a manipulated
 * client clock can't delete a still-live pin early.
 */
export async function expireDrop(dropId: string): Promise<ActionResult<null>> {
  await sql`delete from drops where id = ${dropId} and expires_at < now()`;
  return { ok: true, data: null };
}
