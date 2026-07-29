import {
  TILE_STYLE_URL,
  TWIN_CITIES_CENTER,
  DEFAULT_ZOOM,
  MAX_BOUNDS,
} from './mapConfig.js';
import { CATEGORIES } from '../data/categories.js';

const SOURCE = 'anchors';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Which element actually scrolls the list. On desktop it's the sidebar; below
 * 820px the sidebar is `overflow: visible` and the window scrolls instead.
 */
function scrollBox() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return null;
  const style = getComputedStyle(sidebar);
  const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
  return scrolls && sidebar.scrollHeight > sidebar.clientHeight + 1 ? sidebar : null;
}

/** How far down to place the card: clear of the sticky filter bar. */
function topInset(box) {
  const filters = document.querySelector('.filters');
  if (!filters) return 8;
  const sticky = getComputedStyle(filters).position === 'sticky';
  return (sticky && box ? filters.getBoundingClientRect().height : 0) + 8;
}

/**
 * Distance the card currently sits from where we want it. Measured from live
 * rects rather than accumulated offsetTop, because `content-visibility: auto`
 * gives un-rendered rows a placeholder height — any absolute position summed
 * across them is a guess that stops being true the moment they render.
 */
function alignmentDelta(details, box) {
  const rect = details.getBoundingClientRect();
  const anchorTop = box ? box.getBoundingClientRect().top : 0;
  return rect.top - anchorTop - topInset(box);
}

/**
 * Scrolls a card to the top of the list and keeps correcting until it stays
 * put. One pass is not enough: rows entering the viewport get laid out for the
 * first time as we scroll, which moves the target underneath us.
 */
async function alignCard(details) {
  const box = scrollBox();
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Let the open/close and the content-visibility exemption take effect
  // before measuring anything.
  await nextFrame();
  await nextFrame();

  const scrollBy = (top, behavior) =>
    (box ? box.scrollBy({ top, behavior }) : window.scrollBy({ top, behavior }));

  scrollBy(alignmentDelta(details, box), calm ? 'auto' : 'smooth');

  // Settle: re-measure and nudge until the card stops drifting.
  for (let pass = 0; pass < 4; pass++) {
    await new Promise((r) => setTimeout(r, pass === 0 ? 280 : 60));
    const delta = alignmentDelta(details, box);
    if (Math.abs(delta) <= 2) break;
    scrollBy(delta, 'auto');
  }
}

/** Opens one card and closes any other, without scrolling. */
function openCard(id) {
  const details = document.getElementById(`anchor-${id}`);
  if (!details) return null;

  for (const open of document.querySelectorAll('details.anchor[open]')) {
    if (open !== details) open.open = false;
  }
  details.open = true;
  return details;
}

function closeAllCards() {
  for (const open of document.querySelectorAll('details.anchor[open]')) {
    open.open = false;
  }
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

  const FOCUS_ZOOM = 15;

  /**
   * Where the map was before we zoomed into a site, so dismissing a site can
   * put it back. Captured once per focus session: hopping straight from one
   * site to another keeps the original view, so leaving still returns to where
   * the user actually was rather than to the previous site.
   */
  let priorView = null;

  /*
   * Everything funnels through the card's `toggle` event, which is the only
   * state both halves agree on. A map click just opens the card and lets the
   * toggle move the map; the sidebar does the same. Trying to drive both sides
   * from the click handler needs a re-entrancy guard, and `toggle` fires
   * asynchronously — the guard is already back down by the time it arrives.
   */
  function focusSite(id) {
    const point = byId.get(id);
    if (!point) return;

    if (!priorView) {
      priorView = { center: map.getCenter(), zoom: map.getZoom() };
    }
    map.easeTo({
      center: [point.lon, point.lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
    });

    const details = document.getElementById(`anchor-${id}`);
    if (details) alignCard(details);
  }

  /** Clicking empty map closes the card and returns to the earlier view. */
  function clearFocus() {
    closeAllCards();
    if (!priorView) return;
    map.easeTo(priorView);
    priorView = null;
  }

  // Opening the card is enough — its toggle handler moves and aligns.
  map.on('click', 'points', (e) => {
    const hit = e.features?.[0];
    if (hit) openCard(hit.properties.id);
  });

  // Fires for every click, including those on a point, so check first.
  map.on('click', (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ['points'] }).length) return;
    clearFocus();
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

  // Opening a card from the list moves the map to match; closing it puts the
  // map back, so the sidebar and the map behave the same way round.
  for (const details of document.querySelectorAll('details.anchor')) {
    details.addEventListener('toggle', () => {
      if (details.open) {
        focusSite(details.dataset.anchorId);
      } else if (!document.querySelector('details.anchor[open]')) {
        // The last card closed — whether by the map, the summary, or another
        // card opening and this one being closed for it (in which case the
        // replacement is already open and this branch doesn't run).
        clearFocus();
      }
    });
  }
}
