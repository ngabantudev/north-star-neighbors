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

