import {
  TILE_STYLE_URL,
  TWIN_CITIES_CENTER,
  DEFAULT_ZOOM,
  MAX_BOUNDS,
} from './mapConfig.js';
import { CATEGORIES } from '../data/categories.js';

const SOURCE = 'anchors';

/**
 * Opens the sidebar card for a site and brings it into view. The card is
 * server-rendered, so this only toggles markup that already exists.
 */
function revealAnchor(id) {
  const details = document.getElementById(`anchor-${id}`);
  if (!details) return;

  for (const open of document.querySelectorAll('details.anchor[open]')) {
    if (open !== details) open.open = false;
  }

  details.open = true;
  details.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Pulls in MapLibre's stylesheet on demand. See scripts/vendor-css.mjs. */
function loadMapStyles() {
  return new Promise((resolve) => {
    const href = '/vendor/maplibre-gl.css';
    if (document.querySelector(`link[href="${href}"]`)) return resolve();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    // A missing stylesheet shouldn't stop the map from rendering.
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => resolve());
    document.head.appendChild(link);
  });
}

const toFeature = (a) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
  properties: { id: a.id, name: a.name, primary: a.categories[0] },
});

/** Colour a point by its primary tag, via a data-driven `match`. */
function primaryColorExpression() {
  const cases = CATEGORIES.flatMap((c) => [c.id, c.color]);
  return ['match', ['get', 'primary'], ...cases, '#8a94a6'];
}

export async function initMap(points) {
  const container = document.getElementById('map');
  if (!container || !Array.isArray(points)) return;

  // Both the library and its stylesheet stay out of the initial payload.
  const [{ default: maplibregl }] = await Promise.all([
    import('maplibre-gl'),
    loadMapStyles(),
  ]);

  const map = new maplibregl.Map({
    container,
    style: TILE_STYLE_URL,
    center: TWIN_CITIES_CENTER,
    zoom: DEFAULT_ZOOM,
    maxBounds: MAX_BOUNDS,
    attributionControl: { compact: true },
    // No geolocation control anywhere: the app never asks for coordinates.
    // Cheaper to composite, and we draw no 3D or rotated labels.
    pitchWithRotate: false,
    dragRotate: false,
    refreshExpiredTiles: false,
    fadeDuration: 0,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

  // A bad font or sprite shouldn't take the page down with it.
  map.on('error', (e) => console.warn('[map]', e?.error?.message || e));

  const features = points.map(toFeature);
  const byId = new Map(points.map((p) => [p.id, p]));

  await new Promise((resolve) => map.once('load', resolve));

  /*
   * One GeoJSON source instead of 323 DOM markers. Markers are
   * absolutely-positioned elements that the browser must reposition on every
   * frame of every pan and zoom; this draws on the GPU and keeps the DOM at
   * a constant size no matter how much the dataset grows.
   */
  // Not clustered: every site is one point, drawn at the same size at every
  // zoom. A cluster hides how many places are packed into a block, and this
  // directory is read by people counting on seeing all of them.
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
    id: 'points',
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': primaryColorExpression(),
      'circle-radius': 7,
      'circle-stroke-color': '#0f1115',
      'circle-stroke-width': 1.5,
    },
  });

  // --- interaction ---------------------------------------------------------

  map.on('click', 'points', (e) => {
    const hit = e.features?.[0];
    if (hit) revealAnchor(hit.properties.id);
  });

  map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = ''; });

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 12,
  });

  map.on('mouseenter', 'points', (e) => {
    const hit = e.features?.[0];
    if (!hit) return;
    popup.setLngLat(hit.geometry.coordinates).setText(hit.properties.name).addTo(map);
  });
  map.on('mouseleave', 'points', () => popup.remove());

  // --- filtering -----------------------------------------------------------

  const syncFilters = () => {
    const on = new Set(
      CATEGORIES.map((c) => c.id).filter((id) => document.getElementById(`f-${id}`)?.checked)
    );
    const visible = on.size === CATEGORIES.length
      ? features
      : features.filter((f) => byId.get(f.properties.id).categories.some((c) => on.has(c)));

    map.getSource(SOURCE)?.setData({ type: 'FeatureCollection', features: visible });
  };

  for (const box of document.querySelectorAll('.filter-input')) {
    box.addEventListener('change', syncFilters);
  }
  syncFilters();

  // Opening a card from the list pans the map to match.
  for (const details of document.querySelectorAll('details.anchor')) {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      const point = byId.get(details.dataset.anchorId);
      if (!point) return;
      map.easeTo({ center: [point.lon, point.lat], zoom: Math.max(map.getZoom(), 14) });
    });
  }
}
