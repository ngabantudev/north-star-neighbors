import { sql } from '@/lib/db';
import type { AnchorCategory, CivicAnchor } from '@/lib/types';

// Overpass is OSM's own free query API — same open-data project as the
// OpenFreeMap tiles already in use. No API key, no Google, nationwide.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const TAG_QUERIES: { tag: string; value: string; category: AnchorCategory }[] = [
  { tag: 'amenity', value: 'library', category: 'library' },
  { tag: 'amenity', value: 'community_centre', category: 'community_center' },
  { tag: 'amenity', value: 'social_facility', category: 'community_center' },
  { tag: 'office', value: 'ngo', category: 'community_center' },
  { tag: 'amenity', value: 'fire_station', category: 'fire_station' },
  { tag: 'railway', value: 'station', category: 'transit_hub' },
  { tag: 'amenity', value: 'bus_station', category: 'transit_hub' },
  { tag: 'public_transport', value: 'station', category: 'transit_hub' },
  { tag: 'leisure', value: 'park', category: 'park_plaza' },
  { tag: 'leisure', value: 'playground', category: 'park_plaza' },
  { tag: 'shop', value: 'supermarket', category: 'grocery' },
  { tag: 'shop', value: 'convenience', category: 'grocery' },
];

export interface OsmAnchor extends CivicAnchor {
  osmId: string;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Our own Postgres copy, checked first so repeat lookups in the same area
 *  don't hit the shared public Overpass instance at all. */
async function queryCache(lat: number, lng: number, radiusMeters: number, limit: number): Promise<OsmAnchor[]> {
  const rows = await sql`
    select
      id, osm_id, name, category,
      ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
      ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) as distance_m
    from civic_anchors
    where ST_DWithin(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
    order by distance_m asc
    limit ${limit}
  `;
  return (
    rows as { id: string; osm_id: string | null; name: string; category: AnchorCategory; lat: number; lng: number; distance_m: number }[]
  ).map((r) => ({
    id: r.id,
    osmId: r.osm_id ?? r.id,
    name: r.name,
    category: r.category,
    address: null,
    lat: r.lat,
    lng: r.lng,
    distanceMeters: Math.round(r.distance_m),
  }));
}

/** Best-effort cache warm — failures here never block returning live results. */
async function cacheAnchors(anchors: OsmAnchor[]): Promise<void> {
  await Promise.all(
    anchors.map((a) =>
      sql`
        insert into civic_anchors (osm_id, name, category, location)
        values (${a.osmId}, ${a.name}, ${a.category}, ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography)
        on conflict (osm_id) do update set name = excluded.name
      `.catch((e) => console.error('anchor cache warm failed', e)),
    ),
  );
}

async function fetchFromOverpass(lat: number, lng: number, radiusMeters: number): Promise<OsmAnchor[]> {
  const clauses = TAG_QUERIES.map(
    ({ tag, value }) =>
      `node["${tag}"="${value}"](around:${radiusMeters},${lat},${lng});\n  way["${tag}"="${value}"](around:${radiusMeters},${lat},${lng});`,
  ).join('\n  ');
  const query = `[out:json][timeout:15];\n(\n  ${clauses}\n);\nout center tags;`;

  let data: { elements?: OverpassElement[] };
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'north-star-neighbors (anonymous mutual-aid map; contact via project repo)',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error('overpass request failed', res.status, await res.text().catch(() => ''));
      return [];
    }
    data = await res.json();
  } catch (e) {
    console.error('overpass request errored', e);
    return [];
  }

  const seen = new Set<string>();
  const results: OsmAnchor[] = [];

  for (const el of data.elements ?? []) {
    const name = el.tags?.name;
    if (!name) continue;
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat == null || elLng == null) continue;

    const match = TAG_QUERIES.find(({ tag, value }) => el.tags?.[tag] === value);
    if (!match) continue;

    const dedupeKey = `${name.toLowerCase()}:${elLat.toFixed(4)}:${elLng.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      id: `osm:${el.type}:${el.id}`,
      osmId: `${el.type}/${el.id}`,
      name,
      category: match.category,
      address: null,
      lat: elLat,
      lng: elLng,
      distanceMeters: Math.round(haversineMeters(lat, lng, elLat, elLng)),
    });
  }

  results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return results;
}

/**
 * Live nationwide lookup for real public civic locations (libraries, transit
 * stations, fire stations, community centers) near a point — replaces a
 * hand-curated per-region seed list so the "must be at a real approved
 * public site" safety property holds anywhere in the US, not just one metro.
 *
 * Checks our own Postgres cache first; only falls back to the shared public
 * Overpass instance on a cache miss, and warms the cache from whatever it
 * gets back. This is what keeps normal traffic from hammering (and getting
 * rate-limited by) the free public API.
 */
export async function queryNearbyAnchors(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit: number,
): Promise<OsmAnchor[]> {
  const cached = await queryCache(lat, lng, radiusMeters, limit);
  if (cached.length >= limit) return cached;

  const fresh = await fetchFromOverpass(lat, lng, radiusMeters);
  if (fresh.length === 0) return cached; // Overpass down/rate-limited — fall back to whatever we already had.

  void cacheAnchors(fresh.slice(0, limit));

  const seenIds = new Set(cached.map((a) => a.osmId));
  const merged = [...cached, ...fresh.filter((a) => !seenIds.has(a.osmId))];
  merged.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return merged.slice(0, limit);
}
