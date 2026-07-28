// Spatial address masking for curbside drops. A residential pickup point
// must never be published as-is — this snaps it to the nearest corner of a
// coarse street-block grid instead, so the public pin reads as "somewhere on
// this block" rather than "this exact driveway."
//
// A fixed grid (rather than an OSM road-network lookup like overpass.ts uses
// for anchors) is deliberate: it's self-contained, has zero external-service
// dependency for a privacy guarantee, and is deterministic everywhere in the
// US regardless of local OSM sidewalk/road coverage.
//
// Pure and side-effect-free so both the client (preview only) and the server
// (source of truth) can call it — but never trust the client's fuzzed value;
// the server always re-derives it from the raw coordinate it receives.

// ~0.0007deg of latitude is roughly 78m — about one typical residential
// city block. Longitude degrees shrink with latitude, so we scale by cos(lat)
// to keep the cell roughly square on the ground rather than a fixed degree box.
const GRID_METERS = 78;
const METERS_PER_DEGREE_LAT = 111_320;

export function snapToBlockCorner(lat: number, lng: number): { lat: number; lng: number } {
  const latStep = GRID_METERS / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const lngStep = GRID_METERS / metersPerDegreeLng;

  return {
    lat: Math.round(lat / latStep) * latStep,
    lng: Math.round(lng / lngStep) * lngStep,
  };
}
