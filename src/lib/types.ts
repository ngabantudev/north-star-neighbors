/**
 * Header a client proves drop ownership with on the drop read routes. Lives
 * here (not in dropAccess.ts) so the browser can import it without dragging
 * the server-only db/crypto modules into the client bundle. See
 * @/lib/dropAccess for the rule it feeds.
 */
export const DROP_TOKEN_HEADER = 'x-drop-token';

export type DropCategory = 'produce' | 'coats' | 'medical' | 'water' | 'baby' | 'general';

export type DropStatus = 'AVAILABLE' | 'CLAIMED' | 'COMPLETED' | 'HIDDEN';

export type DropLocationType = 'anchor' | 'curbside';

export type TravelMode = 'walking' | 'biking' | 'rolling';

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walking: '🚶 Walking',
  biking: '🚲 Biking',
  rolling: '🚗 Rolling',
};

export type AnchorCategory = 'library' | 'transit_hub' | 'community_center' | 'park_plaza' | 'fire_station' | 'grocery';

export interface CivicAnchor {
  id: string;
  name: string;
  category: AnchorCategory;
  address: string | null;
  lat: number;
  lng: number;
  distanceMeters?: number;
}

/** Public-facing shape. Never includes token hashes or an exact curbside address. */
export interface DropSummary {
  id: string;
  locationType: DropLocationType;
  anchorId: string | null;
  /** Null for curbside drops — use `DROP_LOCATION_LABEL` instead. */
  anchorName: string | null;
  /** Fuzzed to the nearest block corner for curbside drops; exact for anchor drops. */
  lat: number;
  lng: number;
  categories: DropCategory[];
  details: string | null;
  hasPhoto: boolean;
  status: DropStatus;
  providerHandle: string;
  claimantHandle: string | null;
  expiresAt: string;
  createdAt: string;
}

export const DROP_LOCATION_LABEL: Record<DropLocationType, string> = {
  anchor: 'Public site',
  curbside: 'Curbside drop',
};

/** Real-time signpost wording for a curbside pin's lifecycle. */
export const CURBSIDE_SIGNPOST: Record<'AVAILABLE' | 'CLAIMED' | 'GONE', string> = {
  AVAILABLE: 'Active Stash',
  CLAIMED: 'Claimed — Cache Incoming',
  GONE: 'Cleared Cache',
};

export const DROP_CATEGORY_LABELS: Record<DropCategory, string> = {
  produce: 'Fresh Produce',
  coats: 'Winter Coats',
  medical: 'Medical Supplies',
  water: 'Water',
  baby: 'Baby / Infant Supplies',
  general: 'General Aid',
};

// Never hardcode a fixed list of TTL values — the server validates against a
// range instead, so the UI can offer a freeform custom-timer stepper without
// needing a matching server allowlist per value.
export const TTL_MIN_MINUTES = 30;
export const TTL_MAX_MINUTES = 1440; // 24 hours
export const TTL_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '4 hr', minutes: 240 },
  { label: '24 hr', minutes: 1440 },
] as const;

// Curbside drops sit at a real residential address (even if fuzzed on the
// map), so they get a tighter, non-negotiable expiry window than public-site
// drops — long enough to be useful, short enough to leave no lasting digital
// footprint pointing at someone's home.
export const TTL_CURBSIDE_MIN_MINUTES = 360; // 6 hours
export const TTL_CURBSIDE_MAX_MINUTES = 720; // 12 hours
export const TTL_CURBSIDE_PRESETS = [
  { label: '6 hr', minutes: 360 },
  { label: '8 hr', minutes: 480 },
  { label: '12 hr', minutes: 720 },
] as const;

