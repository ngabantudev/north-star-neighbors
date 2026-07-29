# North Star Neighbors

A read-only static directory of mutual aid sites across Minnesota — food,
shelter, health, supplies, and support services.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/, deployable to any static host
```

## The data

The directory is built from **`src/data/TCMAP Public Data-Grid view.csv`**, a
public export from the Twin Cities Mutual Aid Project's resource list at
<https://tcmap.org/resources/>. That CSV is the base reference and the only
source of truth. TCMAP itself is no longer an active project.

```bash
node scripts/convert-tcmap.mjs   # CSV -> src/data/anchors.json
```

`src/data/anchors.json` is a **build artifact**. Edit the CSV or the converter,
never the JSON — it gets overwritten.

Current output: **323 sites** from 326 source rows.

| Tag | Sites |
| --- | ---: |
| 🍲 Food | 285 |
| 🧺 Supplies | 152 |
| 🩺 Health | 66 |
| 🛏️ Shelter & Warmth | 52 |
| 🤝 Support Services | 33 |

Sites carry every tag that applies — about half provide more than one kind of
aid, so a single category per site would have thrown information away. There
are 26 distinct tag combinations.

### ⚠️ It is stale, and nothing is confirmed

**The source stopped being updated in January 2024.** Every record is marked
`"status": "stale-import"`, every card shows an "Unverified" note with the
listing's own last-updated date, and the sidebar footer carries 911 and 211 as
the authoritative fallbacks.

This matters more here than in a normal app: someone without shelter walking
across a city to a closed door pays a real cost for a wrong listing. Nothing in
this repo has been checked against the organizations themselves.

### What the converter has to work around

The CSV was built for a live mutual aid dashboard, not a directory, so several
fields didn't survive the project winding down.

**Hours were the hard one.** The `currently_open_for_*` columns read `"no"` on
all 326 rows and the opening/closing columns read `"not today"` / `"never"` —
live-status fields, frozen. But 289 sites state their hours inside the
`site_updates` free text ("Shelf of Hope Food Shelf open Wednesdays 10am –
1pm"), so `extractHours()` lifts the sentences carrying both a weekday and a
clock time and shows them **verbatim**, labelled "Quoted from the listing,
unverified."

They are deliberately *not* parsed into structured open/close times. The text
is full of exceptions, multiple programs per site, and closure notices, and a
confidently-wrong opening time is exactly the failure this directory can't
afford. Quoting keeps the source's own hedges intact.

Everything else:

- **No category column.** Tags are inferred from service checkboxes (structured
  but sparse — only 13% of rows tick `hot_meals`) plus the name and free text.
  Text matching is deliberately broad: a false positive costs a stray tag, a
  false negative hides a food shelf from someone looking for food. 3 rows had no
  inferable aid type and were dropped — a computer recycler, a youth donation
  centre, and an unclear space partnership.
- **No phone or website columns.** Both usually appear in the free text, so
  they're extracted by regex — 163 phones and 219 links. Donation and wishlist
  URLs (Amazon, GoFundMe, Venmo) are filtered out; they are not "the official
  page".
- **One broken coordinate.** Keystone Community Food Center had a positive
  longitude, which would place it in China. The converter repairs the sign and
  logs it, and rejects anything still outside Minnesota.
- **Status banners in names.** `"Calvary Food Shelf •••By Appointment Only•••"`
  becomes a clean name plus a service chip. Single-dash banners are only
  stripped on known wording, since real names contain hyphens ("Family
  Pathways - Cambridge Food Shelf").

### No water category

The original MVP called for water alongside food and shelter. The CSV has no
column for it and no site describes providing it, so the tag would have been
permanently empty. Public drinking fountains and splash pads would need a
second source — Minneapolis Park & Recreation Board facility data is the
obvious candidate.

### Scope is statewide, not metro

Despite the name, the source includes sites well outside the Twin Cities —
Northfield, Cambridge, Onamia, Sandstone, and the Brainerd lakes. `MAX_BOUNDS`
in [src/lib/mapConfig.js](src/lib/mapConfig.js) covers Minnesota so those
markers are reachable.

## What ships to the browser

The entire directory is rendered at build time into a single HTML file. First
paint needs `index.html` and one small stylesheet, plus ~4 kB of JavaScript.

MapLibre (~283 kB gzipped) and its stylesheet load **after** first paint, on
idle. On a weak connection the directory is readable before the map arrives,
and if the map never arrives the page still works.

At 323 records the page is ~104 kB gzipped (~930 kB raw). That's one request
with nothing following it, but it is the main thing to watch if the dataset
grows — the free text in `notes` is the bulk of it, and trimming the 420-char
cap in `tidyNotes()` is the cheapest lever.

## Privacy

- No geolocation API call, and no geolocate control on the map.
- No cookies, no `localStorage`, no accounts, no analytics, no tag manager.
- No web fonts — system font stack only.
- The map never asks where you are; it opens on a fixed Twin Cities view.

The **only** third-party request is for map tiles, from OpenFreeMap (no API
key, no per-user tracking). That is isolated in
[src/lib/mapConfig.js](src/lib/mapConfig.js) — point `TILE_STYLE_URL` at a
self-hosted style to make the app fully first-party.

Outbound links — official pages, directions, the donation link below — are
plain `<a href>` elements. Nothing is requested from those hosts until someone
chooses to click, so they don't weaken any of the above. If you add anything
here, keep it that way: a PayPal or analytics *embed* would quietly break the
guarantee that this page phones home to exactly one host.

## Supporting the work

The sidebar footer carries a donation link to
[Rising Waters Mutual Aid](https://risingwatersmutualaid.org/), pointing at
their own PayPal button. It is deliberately the loudest element in the footer.
This directory is a static list; they are the people actually distributing aid,
and money should go to them rather than to the list.

## Works without JavaScript

Filtering is done in CSS. A site should be visible when *any* of its tags is on,
which means it should hide only when *all* of its tags are off — and because
every checkbox is a preceding sibling of the list, a chain of `~` combinators
ANDs their states together:

```css
#f-food:not(:checked) ~ #f-supplies:not(:checked) ~ .list > li[data-cats="food supplies"] { display: none }
```

[src/pages/index.astro](src/pages/index.astro) generates one such rule per tag
combination present in the data at build time. Info cards are `<details>`. With
JavaScript disabled you lose the map and nothing else.

When JavaScript is on, [src/lib/map.js](src/lib/map.js) applies the same
any-tag-checked rule to the markers and links markers to cards in both
directions. Markers take the colour of their primary tag — the scarcest one,
per the order in `categories.js`.

## Layout

```
src/
  data/TCMAP Public Data-Grid view.csv   the base reference
  data/anchors.json                      generated — do not edit
  data/categories.js                     the five tags; order is significant
  lib/mapConfig.js                       all outbound network config, isolated
  lib/map.js                             lazy-loaded map behavior
  components/AnchorCard.astro
  pages/index.astro                      sidebar, generated filter CSS, layout
scripts/
  convert-tcmap.mjs                      CSV -> anchors.json
  vendor-css.mjs                         copies MapLibre CSS to public/
```
