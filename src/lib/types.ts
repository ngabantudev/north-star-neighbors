export type DropCategory = 'produce' | 'coats' | 'medical' | 'water' | 'baby' | 'general';

export type DropStatus = 'AVAILABLE' | 'CLAIMED' | 'COMPLETED' | 'HIDDEN';

export type AnchorCategory = 'library' | 'transit_hub' | 'community_center' | 'park_plaza' | 'fire_station';

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

// TEST VALUES: 1 and 3 minutes, so expiry/auto-removal is easy to observe live.
// Swap back to real spec values before shipping, e.g.:
// { label: '2 hours', minutes: 120 }, { label: '4 hours', minutes: 240 }, { label: 'End of day', minutes: 720 }
export const TTL_OPTIONS = [
  { label: '1 min (test)', minutes: 1 },
  { label: '3 min (test)', minutes: 3 },
] as const;
