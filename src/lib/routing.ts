import type { TravelMode } from '@/lib/types';

// Flat average-speed model for a straight-line ETA estimate — there's no
// turn-by-turn directions engine in this app (see osmDirectionsUrl in
// distance.ts for the real-routing deep link), so this is deliberately a
// rough "how long would this take" figure, not a routed prediction.
const MODE_SPEED_MPS: Record<TravelMode, number> = {
  walking: 1.4, // ~5 km/h
  biking: 4.2, // ~15 km/h
  rolling: 9, // ~32 km/h, city-street driving pace
};

export function estimateEtaMinutes(distanceMeters: number, mode: TravelMode): number {
  const seconds = distanceMeters / MODE_SPEED_MPS[mode];
  return Math.max(1, Math.round(seconds / 60));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { haversineMeters };
