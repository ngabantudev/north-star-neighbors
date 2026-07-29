import { sql } from '@/lib/db';
import { hashToken } from '@/lib/crypto';
import { DROP_TOKEN_HEADER, type DropCategory, type DropLocationType, type DropStatus, type DropSummary } from '@/lib/types';

/**
 * The single server-side read path for `drops`, and the single place that
 * decides who is allowed to see one.
 *
 * Both HTTP routes that expose a drop (`/api/drops`, `/api/drops/[id]`, and the
 * photo sub-route) go through here, so the row shape, the redaction, and the
 * authorization rule can't drift apart between them — a drop id is public
 * knowledge (the ledger publishes one per event), so "knows the id" must never
 * be the thing that grants access.
 */

/** Internal row shape. Carries token hashes, so it never leaves this module. */
interface DropRow {
  id: string;
  location_type: DropLocationType;
  anchor_id: string | null;
  anchor_name: string | null;
  lat: number;
  lng: number;
  categories: DropCategory[];
  details: string | null;
  has_photo: boolean;
  status: DropStatus;
  provider_handle: string;
  claimant_handle: string | null;
  expires_at: string;
  created_at: string;
  provider_token_hash: string;
  claimant_token_hash: string | null;
}

/** Row -> public shape. The only way a drop becomes something a route can send. */
function toSummary(row: DropRow): DropSummary {
  return {
    id: row.id,
    locationType: row.location_type,
    anchorId: row.anchor_id,
    anchorName: row.anchor_name,
    lat: row.lat,
    lng: row.lng,
    categories: row.categories,
    details: row.details,
    hasPhoto: row.has_photo,
    status: row.status,
    providerHandle: row.provider_handle,
    claimantHandle: row.claimant_handle,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** True when the caller's token hashes to the provider or claimant on this drop. */
function isParty(row: Pick<DropRow, 'provider_token_hash' | 'claimant_token_hash'>, token: string | null): boolean {
  if (!token) return false;
  const hash = hashToken(token);
  return hash === row.provider_token_hash || (row.claimant_token_hash !== null && hash === row.claimant_token_hash);
}

/**
 * A drop is readable by anyone only while it's on the public map. Once it is
 * CLAIMED or HIDDEN it is a private handoff between two people (and, for
 * curbside, a pin sitting near someone's home) — from then on only the provider
 * and the claimant may read its details, handles, coordinate, or photo.
 */
type DropAccessFields = Pick<DropRow, 'status' | 'provider_token_hash' | 'claimant_token_hash'>;

function canView(row: DropAccessFields, token: string | null): boolean {
  return row.status === 'AVAILABLE' || isParty(row, token);
}

/** The caller's ownership token, if they sent one. */
export function dropTokenFrom(req: Request): string | null {
  return req.headers.get(DROP_TOKEN_HEADER);
}

/**
 * One query for both the list and the by-id lookup. `location` is always the
 * published coordinate — block-fuzzed for curbside — so `exact_location` is
 * unreachable from any HTTP route by construction, not by remembering to omit
 * it in two places (only the getExactLocation server action resolves it).
 */
async function queryDrops(id: string | null): Promise<DropRow[]> {
  const rows = await sql`
    select
      d.id, d.location_type, d.anchor_id, a.name as anchor_name,
      ST_Y(d.location::geometry) as lat, ST_X(d.location::geometry) as lng,
      d.categories, d.details, (d.photo is not null) as has_photo, d.status,
      d.provider_handle, d.claimant_handle, d.expires_at, d.created_at,
      d.provider_token_hash, d.claimant_token_hash
    from drops d
    left join civic_anchors a on a.id = d.anchor_id
    where d.expires_at > now()
      and (${id}::uuid is null or d.id = ${id}::uuid)
      -- The list is the public map: AVAILABLE only, so claimed pins stop being
      -- advertised and no two receivers dispatch to the same pickup.
      and (${id}::uuid is not null or d.status = 'AVAILABLE')
    order by d.created_at desc
  `;
  return rows as DropRow[];
}

export async function listPublicDrops(): Promise<DropSummary[]> {
  return (await queryDrops(null)).map(toSummary);
}

/** Null for "no such live drop" *and* for "not yours" — an unauthorized caller
 *  can't distinguish the two, so ids can't be probed for existence. */
export async function getDropForViewer(id: string, token: string | null): Promise<DropSummary | null> {
  const [row] = await queryDrops(id);
  if (!row || !canView(row, token)) return null;
  return toSummary(row);
}

export async function getDropPhotoForViewer(
  id: string,
  token: string | null,
): Promise<{ photo: Buffer; contentType: string } | null> {
  const rows = await sql`
    select photo, photo_content_type, status, provider_token_hash, claimant_token_hash
    from drops
    where id = ${id}::uuid and expires_at > now() and photo is not null
  `;
  const row = rows[0] as (DropAccessFields & { photo: Buffer; photo_content_type: string | null }) | undefined;
  if (!row || !canView(row, token)) return null;

  return { photo: row.photo, contentType: row.photo_content_type ?? 'image/jpeg' };
}
