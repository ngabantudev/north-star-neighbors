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

/** Keeps panning inside the metro so the map can't get lost. */
export const MAX_BOUNDS = [
  [-93.75, 44.65],
  [-92.75, 45.25],
];
