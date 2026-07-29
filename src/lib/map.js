import {
  TILE_STYLE_URL,
  TWIN_CITIES_CENTER,
  DEFAULT_ZOOM,
  MAX_BOUNDS,
} from './mapConfig.js';
import { CATEGORY_BY_ID } from '../data/categories.js';

/**
 * Opens the sidebar card for an anchor and brings it into view. The card
 * itself is server-rendered, so this only ever toggles existing markup.
 */
function revealAnchor(id) {
  const details = document.getElementById(`anchor-${id}`);
  if (!details) return;

  document
    .querySelectorAll('details.anchor[open]')
    .forEach((d) => {
      if (d !== details) d.open = false;
    });

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

function makeMarkerEl(anchor, category) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ns-marker';
  el.style.setProperty('--marker', category.color);
  el.setAttribute('aria-label', `${anchor.name} — ${category.label}`);
  el.textContent = category.emoji;
  return el;
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
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

  const markers = new Map();

  for (const anchor of points) {
    const category = CATEGORY_BY_ID[anchor.category];
    if (!category) continue;

    const el = makeMarkerEl(anchor, category);
    el.addEventListener('click', () => revealAnchor(anchor.id));

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([anchor.lon, anchor.lat])
      .addTo(map);

    markers.set(anchor.id, { marker, el, category: anchor.category });
  }

  // Keep the map layers in step with the CSS-driven sidebar filters.
  const syncFilters = () => {
    for (const { el, category } of markers.values()) {
      const box = document.getElementById(`f-${category}`);
      el.hidden = box ? !box.checked : false;
    }
  };

  document
    .querySelectorAll('.filter-input')
    .forEach((box) => box.addEventListener('change', syncFilters));
  syncFilters();

  // Opening a card from the list pans the map to match.
  document.querySelectorAll('details.anchor').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      const entry = markers.get(details.dataset.anchorId);
      if (!entry) return;
      map.easeTo({ center: entry.marker.getLngLat(), zoom: Math.max(map.getZoom(), 13) });
    });
  });
}
