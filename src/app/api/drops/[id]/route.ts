import { sql } from '@/lib/db';
import type { DropCategory, DropSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Detail lookup by id, used by the provider/claimant who already hold the id
// locally (from creating or claiming the pin) to poll status even after the
// pin has been masked from the public list. Never returns token hashes.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await sql`
    select
      d.id, d.anchor_id, a.name as anchor_name,
      ST_Y(d.location::geometry) as lat, ST_X(d.location::geometry) as lng,
      d.categories, d.details, (d.photo is not null) as has_photo, d.status,
      d.provider_handle, d.claimant_handle, d.expires_at, d.created_at
    from drops d
    join civic_anchors a on a.id = d.anchor_id
    where d.id = ${id} and d.expires_at > now()
  `;

  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const row = rows[0] as {
    id: string;
    anchor_id: string;
    anchor_name: string;
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

  const drop: DropSummary = {
    id: row.id,
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

  return Response.json({ drop });
}
