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
| Food | 285 |
| Supplies | 152 |
| Health | 66 |
| Shelter & Warmth | 52 |
| Support Services | 33 |
| Housing Intake (HMIS) | 28 |

Sites carry every tag that applies — about half provide more than one kind of
aid, so a single category per site would have thrown information away. There
are 36 distinct tag combinations.

### ⚠️ It is stale, and nothing is confirmed

**The source stopped being updated in January 2024.** Every record is marked
`"status": "stale-import"`, every card shows an "Unverified" note with the
listing's own last-updated date, and the sidebar footer carries 911 and 211 as
the authoritative fallbacks.

This matters more here than in a normal app: someone without shelter walking
across a city to a closed door pays a real cost for a wrong listing. Nothing in
this repo has been checked against the organizations themselves.

### The HMIS cross-reference

`src/data/Agencies Participating In MN's HMIS-Grid view.csv` lists the 297
agencies participating in Minnesota's Homeless Management Information System —
the organizations that do intakes with people experiencing homelessness. An
agency on that list is plugged into coordinated entry and can start a housing
referral, which is a scarcer thing than a hot meal.

```bash
node scripts/match-hmis.mjs   # -> src/data/hmis-matches.json
```

**28 of the 323 sites** match, across 21 agencies. The output is committed so
the matches can be read and corrected by hand; delete an entry to reject one.

**HMIS participation is recorded per agency; this directory lists sites.** VEAP
participates in HMIS, but that does not mean VEAP's mobile food pantry in a
mosque parking lot can process housing paperwork. So the `hmis` tag claims only
what the data supports — that the site is *run by* an HMIS agency — every card
names the matched agency so a reader can judge it, and the card text says
plainly "though not necessarily at this address."

For the same reason `hmis` sits **last** in `categories.js`: it is a property of
the operator, not a kind of aid, and a site's map colour should come from what
it hands out rather than from its paperwork.

The matcher is tuned for precision over recall — a missed match costs a filter
hit, a false one tells someone sleeping outside that a food shelf can start
their housing case. It matches on full-name containment and genuine acronyms
only. An earlier, looser pass produced 71 matches including *Hennepin Technical
College* ← *Hennepin County* and *Mother Jeanette Frazier Food Shelf* ←
*Frazier Recovery Homes*; many entries in the abbreviation column are short
names rather than acronyms, which is what caused it.

### Verifying the data

Two checkers, both free and keyless. Neither proves an organization is still
operating — that needs a human, or a Google Places key the repo doesn't have.

```bash
node scripts/verify-links.mjs --json report.json   # ~1 min
node scripts/verify-osm.mjs   --json report.json   # ~6 min (rate-limited)
```

**`verify-links.mjs`** probes the 219 official links. It distinguishes cases a
bare status check would conflate:

| Verdict | Meaning |
| --- | --- |
| `ok` / `redirected` | answers, alive |
| `stale-path` | page 404s but the domain answers — link rot, not closure |
| `blocked` | 403, almost always a bot filter |
| `parked` | redirects to a domain-sale lander — strong closure signal |
| `dead-domain` | nothing answers at the origin either |

Last run: 140 ok, 11 redirected, 64 stale-path, 1 parked, 3 dead-domain. The
64 stale paths are repaired via `src/data/link-overrides.json`, which
`convert-tcmap.mjs` layers over the CSV — `anchors.json` is regenerated every
run, so a fix applied there would be wiped.

The one unambiguous casualty is Lighthouse Church - Rosemount, whose domain
has lapsed to an expired-domain lander.

**`verify-osm.mjs`** geocodes every address with Nominatim and measures the
distance to the stored coordinates. Last run: **243 match** (within 250m),
**31 nearby**, **21 mismatch**, **28 not-found**.

Read the mismatches carefully. Only 4 are real: those where Nominatim resolved
an exact house number and still landed kilometres away. The other 17 are the
geocoder falling back to a street centroid because it couldn't pin the number
— an artifact of the check, not a bad coordinate. The four worth a human look:

| Site | Off by |
| --- | ---: |
| Family Pathways - Cambridge Food Shelf | 5.1 km |
| Keystone Foodmobile - Rice Street Library | 4.8 km |
| Family Pathways - Chisago Area Food Shelf | 3.3 km |
| Sisters' Camelot Food Share: St. Mary's | 2.4 km |

Nominatim is a donated public service: the script holds itself to one request
per second with an identifying User-Agent. **Don't raise the rate.**

A clean pass from either script means the address is real and the website
answers. It does not mean the door is open. Everything here is still
`"status": "stale-import"`.

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
paint needs `index.html` and one small stylesheet, plus ~4.5 kB of JavaScript.

MapLibre (~283 kB gzipped) and its stylesheet load **after** first paint, on
idle. On a weak connection the directory is readable before the map arrives,
and if the map never arrives the page still works.

At 323 records the page is **~114 kB gzipped** (~1.1 MB raw) — one request with
nothing following it.

### Rendering

Two things do the heavy lifting, and neither is about bytes:

- **`content-visibility: auto`** on list rows. 323 cards is a lot of layout and
  paint, nearly all of it offscreen; this lets the browser skip a row until it
  is nearly in view, with `contain-intrinsic-size` supplying a placeholder
  height so the scrollbar behaves. An open card is exempted via `:has()` so it
  never skips while being read.
- **The map is one GeoJSON source and one GL circle layer**, not 323 DOM
  markers. Markers are absolutely-positioned elements the browser repositions
  on every frame of every pan; this draws on the GPU and holds the DOM at a
  constant size however far the dataset grows. Rotate and pitch are off and
  `fadeDuration` is 0.

Points are deliberately **not clustered** — every site is one dot at a fixed
radius at every zoom, coloured by its primary tag. A cluster hides how many
places are packed into a block, and people read this list counting on seeing
all of them.

### Icons

Lucide, emitted as a single inline SVG sprite in `src/lib/icons.js`, with each
use site a ~40-byte `<use>` reference. No icon font, no sprite request, no
runtime JavaScript.

Inlining the full markup at each site instead cost **21 kB gzipped**: with 323
cards, an inline icon is an icon paid for 323 times. If page weight ever needs
to come down, dropping icons from the repeated section headers is the cheapest
~8 kB. `lucide-static` is a devDependency — nothing from it ships as a package,
only the path data it contributes.

### A byte lesson worth keeping

Stripping the hours sentences out of `notes` (so the card doesn't print the
same opening times twice) cut 8 kB of raw HTML but *raised* the gzipped size by
2.5 kB. Duplicated text compresses to almost nothing, and removing it hurt the
compression ratio more than it saved. It stayed for the reading experience, not
for the bytes — measure gzipped, not raw.

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
  data/Agencies ... HMIS-Grid view.csv   HMIS agency list
  data/link-overrides.json               repaired URLs, layered over the CSV
  data/hmis-matches.json                 site -> HMIS agency, reviewable
  data/categories.js                     the six tags; order is significant
  lib/mapConfig.js                       all outbound network config, isolated
  lib/map.js                             lazy-loaded map behavior
  lib/icons.js                           Lucide sprite, inlined at build time
  components/AnchorCard.astro
  layouts/Base.astro                     document shell + icon sprite
  pages/index.astro                      sidebar, generated filter CSS, layout
scripts/
  convert-tcmap.mjs                      CSV -> anchors.json
  match-hmis.mjs                         cross-reference the HMIS agency list
  verify-links.mjs                       official-link liveness check
  verify-osm.mjs                         address cross-check via Nominatim
  vendor-css.mjs                         copies MapLibre CSS to public/
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` | the site |
| `npm run data` | regenerate `anchors.json` from the CSV |
| `npm run hmis` | rebuild the HMIS matches, then re-run `data` |
| `npm run verify:links` | check the 219 official links (~1 min) |
| `npm run verify:osm` | cross-check addresses against OSM (~6 min) |
