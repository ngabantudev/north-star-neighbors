import { sql } from '@/lib/db';
import type { DropCategory, DropLocationType, DropSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

type DropRow = {
  id: string;
  location_type: DropLocationType;
  anchor_id: string | null;
  anchor_name: string | null;
  lat: number;
  lng: number;
  categories: DropCategory[];
  details: string | null;
  has_photo: boolean;
  status: string;
  provider_handle: string;
  claimant_handle: string | null;
  expires_at: string;
  created_at: string;
};

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
    status: row.status as DropSummary['status'],
    providerHandle: row.provider_handle,
    claimantHandle: row.claimant_handle,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// Public, masked view: only AVAILABLE pins. Claimed pins disappear from the
// shared map so no two receivers dispatch to the same pickup. `d.location`
// is already the published (block-fuzzed, for curbside) coordinate — this
// never selects `exact_location`.
export async function GET() {
  const rows = await sql`
    select
      d.id, d.location_type, d.anchor_id, a.name as anchor_name,
      ST_Y(d.location::geometry) as lat, ST_X(d.location::geometry) as lng,
      d.categories, d.details, (d.photo is not null) as has_photo, d.status,
      d.provider_handle, d.claimant_handle, d.expires_at, d.created_at
    from drops d
    left join civic_anchors a on a.id = d.anchor_id
    where d.status = 'AVAILABLE' and d.expires_at > now()
    order by d.created_at desc
  `;

  return Response.json({ drops: (rows as DropRow[]).map(toSummary) });
}
