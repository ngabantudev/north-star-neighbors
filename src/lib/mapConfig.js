/**
 * Everything about the map's outbound network access lives here, so that a
 * privacy audit of this app is a one-file job.
 *
 * OpenFreeMap serves vector tiles with no API key, no account, and no
 * per-user tracking. It is the only third-party host this site contacts.
 * Swap TILE_STYLE_URL for a self-hosted style to make the app fully
 * first-party.
 */
export const TILE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Downtown-to-downtown midpoint, framing both cities on open. */
export const TWIN_CITIES_CENTER = [-93.1866, 44.9625];
export const DEFAULT_ZOOM = 10.6;

/**
 * Wide enough to cover Minnesota. The metro is the centre of gravity, but the
 * source data includes sites as far out as Onamia, Sandstone, and the
 * Brainerd lakes — a metro-only bound left those markers unreachable.
 */
export const MAX_BOUNDS = [
  [-97.5, 43.4],
  [-89.4, 49.5],
];
