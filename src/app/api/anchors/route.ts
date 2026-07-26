import { queryNearbyAnchors } from '@/lib/overpass';

export const dynamic = 'force-dynamic';

// Wider than the strict placement-precision check (ANCHOR_TOLERANCE_METERS in
// actions.ts) — this is just "how far to search for candidates," generous
// enough for lower-density areas nationwide.
const DEFAULT_RADIUS_METERS = 8000;
const MAX_RESULTS = 8;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const requestedLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_RESULTS) : MAX_RESULTS;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: 'lat and lng query params are required' }, { status: 400 });
  }

  const anchors = await queryNearbyAnchors(lat, lng, DEFAULT_RADIUS_METERS, limit);
  return Response.json({ anchors });
}
