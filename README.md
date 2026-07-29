# North Star Neighbors

A read-only static directory of permanent survival infrastructure — water, food,
and shelter — across Minneapolis and Saint Paul.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/, deployable to any static host
```

## What ships to the browser

The entire directory is rendered at build time into a single HTML file. First
paint needs `index.html`, one small stylesheet, and ~3.5 kB of JavaScript.

MapLibre (~283 kB gzipped) and its stylesheet are pulled in **after** first
paint, on idle. On a weak connection the directory is readable and searchable
before the map arrives, and if the map never arrives the page still works.

## Privacy

- No geolocation API call, and no geolocate control on the map.
- No cookies, no `localStorage`, no accounts, no analytics, no tag manager.
- No web fonts — system font stack only.
- The map never asks where you are; it opens on a fixed Twin Cities view.

The **only** third-party request the site makes is for map tiles, from
OpenFreeMap (no API key, no per-user tracking). That is isolated in
[src/lib/mapConfig.js](src/lib/mapConfig.js) — point `TILE_STYLE_URL` at a
self-hosted style to make the app fully first-party.

## Works without JavaScript

Category filtering is done in CSS, using checkbox state and sibling selectors
(see the `#f-water:not(:checked) ~ .list` rules in
[src/pages/index.astro](src/pages/index.astro)). Info cards are `<details>`
elements. With JavaScript disabled you lose the map and nothing else.

When JavaScript is on, [src/lib/map.js](src/lib/map.js) syncs the map markers
to those same checkboxes and links markers to cards in both directions.

## ⚠️ The data is unverified

[src/data/anchors.json](src/data/anchors.json) is a **seed dataset**, not a
verified one. It was compiled from general knowledge of Twin Cities
institutions, and every record is marked `"status": "seed"`.

Specifically:

- **Hours are `null` for most records.** Rather than guess, the UI says
  "Not verified here. Call or check the official page before travelling."
  The only hours asserted are Minneapolis park hours (6am–midnight), which
  come from park board ordinance rather than per-site schedules.
- **Coordinates are approximate** — good enough to find a block, not to
  distinguish adjacent buildings.
- **Phone numbers and addresses need checking** against each organization's
  official page before this goes in front of anyone relying on it.

This matters more here than in a normal app: someone without shelter walking
across a city to a closed door pays a real cost for a wrong listing. Every
card shows an "Unconfirmed listing" note and a link to the official page, and
the sidebar footer carries **911** and **211** as the authoritative fallbacks.

Before launch, each record should be confirmed against its source and flipped
to `"status": "verified"` with a `checkedOn` date. Good upstream sources:
Hennepin County Library and Saint Paul Public Library location APIs, Minneapolis
Park & Recreation Board facility data, Second Harvest Heartland's food shelf
locator, and Minnesota 211.

## Layout

```
src/
  data/anchors.json      the directory (one JSON record per location)
  data/categories.js     the three categories; drives filters and colors
  lib/mapConfig.js       all outbound network config, isolated for audit
  lib/map.js             lazy-loaded map behavior
  components/            AnchorCard.astro
  pages/index.astro      sidebar, CSS-only filters, layout
scripts/vendor-css.mjs   copies MapLibre's CSS to public/ so it stays lazy
```
