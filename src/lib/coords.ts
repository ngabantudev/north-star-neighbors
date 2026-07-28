// Twin Cities — used whenever a request has no usable lat/lng (geolocation
// denied/unavailable client-side, or the param is simply missing).
export const DEFAULT_LAT = 44.9778;
export const DEFAULT_LNG = -93.265;

/**
 * Parses a lat/lng query param, falling back when it's absent OR garbage.
 *
 * `raw` is `null` when the param is missing (URLSearchParams.get's
 * contract) — and `Number(null)` is `0`, which passes `Number.isFinite`, so
 * a naive `Number(raw) || fallback`-style check silently turns "no
 * coordinate provided" into "(0, 0)" instead of the intended default. Must
 * check for `null` explicitly before parsing.
 */
export function coerceCoord(raw: string | null, fallback: number, precision: number): number {
  if (raw === null) return Number(fallback.toFixed(precision));
  const n = Number(raw);
  const value = Number.isFinite(n) ? n : fallback;
  return Number(value.toFixed(precision));
}
