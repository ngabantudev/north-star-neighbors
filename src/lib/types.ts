export type DropCategory = 'produce' | 'coats' | 'medical' | 'water' | 'baby' | 'general';

export type DropStatus = 'AVAILABLE' | 'CLAIMED' | 'COMPLETED' | 'HIDDEN';

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

/** Public-facing shape. Never includes token hashes. */
export interface DropSummary {
  id: string;
  anchorId: string;
  anchorName: string;
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

export const DROP_CATEGORY_LABELS: Record<DropCategory, string> = {
  produce: 'Fresh Produce',
  coats: 'Winter Coats',
  medical: 'Medical Supplies',
  water: 'Water',
  baby: 'Baby / Infant Supplies',
  general: 'General Aid',
};

// The "weather radar" overlay groups drop categories into four thematic
// buckets, each with its own color gradient. 'general' has no clear bucket
// and is intentionally left out of the radar (matches db's category_radar_geojson).
export type RadarCategory = 'warmth' | 'food' | 'medical' | 'family';

export const RADAR_CATEGORY_BY_DROP_CATEGORY: Record<DropCategory, RadarCategory | null> = {
  coats: 'warmth',
  produce: 'food',
  water: 'food',
  medical: 'medical',
  baby: 'family',
  general: null,
};

export const RADAR_CATEGORY_COLORS: Record<RadarCategory, string> = {
  warmth: '#2563eb',
  food: '#f97316',
  medical: '#16a34a',
  family: '#c026d3',
};

export const RADAR_CATEGORY_LABELS: Record<RadarCategory, string> = {
  warmth: 'Warmth requests',
  food: 'Food requests',
  medical: 'Medical requests',
  family: 'Family care requests',
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

