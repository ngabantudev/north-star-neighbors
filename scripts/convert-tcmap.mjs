/**
 * Converts the TCMAP (Twin Cities Mutual Aid Project) CSV export into the
 * anchors.json the map consumes.
 *
 *   node scripts/convert-tcmap.mjs
 *
 * anchors.json is a build artifact of the CSV. Edit the CSV or this script,
 * never the JSON.
 *
 * What the source can and cannot give us:
 *   - 326 organizations, every one with an address and coordinates. Good.
 *   - No hours. `currently_open_for_distributing` reads "no" on all 326 rows
 *     and the opening/closing columns read "not today" / "never" — live
 *     status fields that froze when the project wound down. We emit
 *     hours: null rather than import a dataset claiming everything is shut.
 *   - No phone or website columns. Both usually appear in the `site_updates`
 *     free text, so we extract them and flag the result as unverified.
 *   - No category column, so tags are inferred (see classify()).
 *   - No water. No column, and no site describes providing it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_ORDER, sortCategories } from '../src/data/categories.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src/data/TCMAP Public Data-Grid view.csv');
const OUT = resolve(root, 'src/data/anchors.json');
const OVERRIDES = resolve(root, 'src/data/link-overrides.json');
const HMIS_MATCHES = resolve(root, 'src/data/hmis-matches.json');

/**
 * Corrections layered on top of the CSV. anchors.json is regenerated on every
 * run, so a fix applied there would be wiped — repairs have to live here to
 * survive. Produced by scripts/verify-links.mjs.
 */
let linkOverrides = {};
try {
  linkOverrides = JSON.parse(readFileSync(OVERRIDES, 'utf8')).urls || {};
} catch {
  // Optional file: converting without it just leaves the CSV's URLs alone.
}

/**
 * Sites run by an agency in Minnesota's HMIS. Produced by
 * scripts/match-hmis.mjs, which must run after this script (it reads
 * anchors.json), so the first conversion on a clean checkout simply has no
 * matches to apply.
 */
let hmisMatches = {};
try {
  hmisMatches = JSON.parse(readFileSync(HMIS_MATCHES, 'utf8')).matches || {};
} catch {
  // Optional file.
}

/** RFC 4180-ish parser: quoted fields may contain commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * Names carry status banners in several house styles:
 *   "Calvary Food Shelf •••By Appointment Only•••"
 *   "510 Board and Lodge (Agate Housing) -By Appointment Only-"
 * Strip them from the name and recover them as structured flags.
 */
const BANNER_RE = /\s*(?:[•·]{2,}|-{2,})\s*([^•·\-][^•·]*?)\s*(?:[•·]{2,}|-{2,})\s*/g;

/**
 * Some rows use single dashes instead of bullets. We can't strip those
 * generically — plenty of real names contain a hyphen ("Family Pathways -
 * Cambridge Food Shelf") — so this only fires on known banner wording.
 */
const DASH_BANNER_RE = /\s*-\s*((?:by )?appointment[^-]*|delivery only|students only|closed[^-]*)\s*-\s*$/i;

function splitBanners(raw) {
  const banners = [];
  let name = raw.replace(BANNER_RE, (_, inner) => { banners.push(inner.trim()); return ' '; });
  name = name.replace(DASH_BANNER_RE, (_, inner) => { banners.push(inner.trim()); return ''; });
  return { name: name.replace(/\s+/g, ' ').trim(), banners };
}

function bannerFlags(banners) {
  const text = banners.join(' ').toLowerCase();
  const flags = [];
  if (text.includes('appointment')) flags.push('By appointment only');
  if (text.includes('delivery only')) flags.push('Delivery only');
  if (text.includes('students only')) flags.push('Students only');
  return flags;
}

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})\b/;
const URL_RE = /https?:\/\/[^\s,)"'<>]+/g;
/** Donation and wishlist links are not "the official page". */
const DONATION_HOST = /amazon\.|amzn\.|gofundme|venmo|paypal|cash\.app|givebutter|donorbox|bit\.ly|signupgenius/i;

const extractPhone = (t) => {
  const m = (t || '').match(PHONE_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const extractUrl = (t) => {
  const all = (t || '').match(URL_RE) || [];
  return all.map((u) => u.replace(/[.,;:]+$/, '')).find((u) => !DONATION_HOST.test(u)) || null;
};

/** "3726 Chicago Ave, Minneapolis, MN 55407" -> street + city. */
function splitAddress(full) {
  const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { address: full.trim(), city: '' };
  return { address: parts[0], city: parts.slice(1).join(', ') };
}

/**
 * Minnesota sits at positive latitude and negative longitude. One row
 * (Keystone Community Food Center) has its longitude sign flipped, which
 * would drop the marker in China. Repair the sign and report it; reject
 * anything still outside a generous state bounding box.
 */
function normalizeCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false };

  let fixed = false;
  if (lon > 0 && lon > 85 && lon < 100) { lon = -lon; fixed = true; }

  const ok = lat > 43 && lat < 49.5 && lon > -97.5 && lon < -89;
  return { ok, lat, lon, fixed };
}

/** Checkbox column -> card label. */
const SERVICE_LABELS = {
  hot_meals: 'Hot meals',
  produce: 'Fresh produce',
  food_delivery: 'Food delivery',
  pet_food: 'Pet food',
  household_supplies: 'Household supplies',
  clothing: 'Clothing',
  baby_toddler: 'Baby & toddler supplies',
  warming_site: 'Warming site',
  housing_support: 'Housing support',
  wheelchair_accessible: 'ADA accessible',
  no_id_needed: 'No ID required',
  insurance_not_needed: 'No insurance needed',
  some_info_required: 'Some info required',
  by_appointment: 'By appointment',
  delivery_only: 'Delivery only',
  distribution_to_residents_only: 'Residents only',
  restricted_distribution: 'Restricted distribution',
  mental_health_services: 'Mental health services',
  healing_resources: 'Healing resources',
  needle_exchange: 'Syringe exchange',
  covid_testing: 'COVID testing',
  COVID_Vaccination: 'COVID vaccination',
  vaccinations_general: 'Vaccinations',
  dental: 'Dental care',
  pet_vaccination_health: 'Pet vaccination & care',
  legal_support: 'Legal support',
  immigration_naturalization: 'Immigration support',
  refugee_services: 'Refugee services',
  transportation_vouchers: 'Transportation vouchers',
  education: 'Education',
  community_service: 'Community service',
  elder: 'Elder services',
  youth: 'Youth services',
  spanish_speaking: 'Spanish spoken',
  somali_speaking: 'Somali spoken',
  karen_speaking: 'Karen spoken',
  lgbtqia_supportive: 'LGBTQIA+ supportive',
  trans_supportive: 'Trans supportive',
  qtibpoc_supportive: 'QTIBIPOC supportive',
  black_run: 'Black-run',
  black_own: 'Black-owned',
  indigenous_owned: 'Indigenous-owned',
  indigenous_run: 'Indigenous-run',
  community_run: 'Community-run',
  memorial_space: 'Memorial space',
  medic_on_site: 'Medic on site',
  art_resources: 'Art resources',
};

/**
 * Tag inference. Checkbox columns are structured and trustworthy but sparse
 * (only 13% of rows tick hot_meals), so we also read the name and the
 * free-text description. Text matching is deliberately broad: for a survival
 * directory, a false positive costs a wasted tag, a false negative hides a
 * food shelf from someone looking for food.
 */
const CLASSIFIERS = {
  shelter: {
    flags: ['warming_site', 'housing_support'],
    re: /\bshelter\b|\bhousing\b|warming|overnight|encampment|\blibrary\b|drop-?in|unhoused|homeless/i,
  },
  food: {
    // "food" is matched without word boundaries on purpose: the only signal
    // for one site was its own domain, whitebearfoodshelf.org. The trailing
    // terms catch sites that list what they hand out without ever using the
    // word "food" — e.g. "fresh fruits and vegetables, meat, milk, dairy".
    flags: ['hot_meals', 'produce', 'food_delivery', 'pet_food'],
    re: /food|\bmeals?\b|pantry|grocer|produce|kitchen|fridge|nutrition|hunger|snack|lunch|dinner|breakfast|\bmarket\b|vegetable|\bdairy\b|\bbread\b|\bmilk\b/i,
  },
  health: {
    flags: ['covid_testing', 'vaccinations_general', 'dental', 'needle_exchange',
      'mental_health_services', 'healing_resources', 'insurance_not_needed',
      'COVID_Vaccination', 'pet_vaccination_health', 'medic_on_site'],
    re: /clinic|health|medical|dental|syringe|narcan|naloxone|harm reduction|vaccin|mental health|therapy|recovery|\bnurse\b/i,
  },
  supplies: {
    flags: ['clothing', 'household_supplies', 'baby_toddler'],
    re: /cloth(es|ing)|diaper|hygiene|toiletr|household|blanket|\bcoats?\b|shoes|supplies|furniture|\bthrift\b/i,
  },
  support: {
    flags: ['legal_support', 'immigration_naturalization', 'transportation_vouchers',
      'education', 'community_service', 'refugee_services'],
    re: /legal|immigra|refugee|educat|tutor|\bjobs?\b|employment|case manage|translat|interpret|literacy/i,
  },
};

function classify(row, get) {
  // Name plus every field describing what the site hands out.
  const blob = [
    get(row, 'org_name'), get(row, 'site_updates'),
    get(row, 'accepting'), get(row, 'urgent_need'),
  ].join(' ');

  const tags = [];
  for (const id of CATEGORY_ORDER) {
    // Not every tag is inferred from the text. `hmis` comes from matching
    // against a separate agency list — see scripts/match-hmis.mjs.
    const classifier = CLASSIFIERS[id];
    if (!classifier) continue;

    const byFlag = classifier.flags.some((c) => get(row, c) === 'checked');
    if (byFlag || classifier.re.test(blob)) tags.push(id);
  }
  return tags;
}

/**
 * The source has no usable hours columns, but 291 of 323 sites state their
 * hours inside the `site_updates` free text ("Shelf of Hope Food Shelf open
 * Wednesdays 10am - 1pm").
 *
 * We pull out the sentences carrying both a weekday and a clock time and show
 * them verbatim. Parsing them into structured open/close times would be
 * guessing: the text is full of exceptions, multiple programs per site, and
 * closure notices, and a confidently-wrong opening time sends someone across
 * a city for nothing. Quoting keeps the source's own hedges intact.
 */
const DAY_RE = /\b(mon|tues?|wed(nes)?|thur?s?|fri|sat(ur)?|sun)(day)?s?\b|\bdaily\b|\bevery day\b|\bweekday/i;
const TIME_RE = /\b(1[0-2]|0?[1-9])(:[0-5][0-9])?\s?[ap]\.?m\.?\b|\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/i;

function extractHours(text) {
  if (!text) return null;

  const sentences = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const hits = [];
  for (const s of sentences) {
    if (!DAY_RE.test(s) || !TIME_RE.test(s)) continue;
    // Skip lines that are really about donating rather than receiving.
    if (/wishlist|amazon|venmo|paypal|donate money|gofundme/i.test(s)) continue;
    const clipped = s.length > 180 ? s.slice(0, 180).trimEnd() + '…' : s;
    if (!hits.includes(clipped)) hits.push(clipped);
    if (hits.length === 4) break;
  }
  return hits.length ? hits : null;
}

/**
 * Collapses whitespace and trims the free-text blob to card length.
 *
 * Sentences already surfaced under Hours are dropped: the card renders both
 * blocks, so keeping them would print the same opening times twice and charge
 * the reader — and the page weight — for it 323 times over.
 */
function tidyNotes(text, hours, limit = 420) {
  let flat = (text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return null;

  for (const line of hours || []) {
    const quoted = line.replace(/…$/, '');
    if (quoted.length > 12) flat = flat.split(quoted).join(' ');
  }
  flat = flat.replace(/\s+/g, ' ').replace(/^[\s.;,]+/, '').trim();
  if (!flat) return null;

  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const stop = cut.lastIndexOf('. ');
  return stop > limit * 0.5 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…';
}

// ---------------------------------------------------------------------------

const raw = readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const rows = parseCsv(raw);
const header = rows[0].map((h) => h.trim());
const index = Object.fromEntries(header.map((h, i) => [h, i]));
const get = (row, col) => (index[col] === undefined ? '' : (row[index[col]] || '').trim());

const body = rows.slice(1).filter((r) => r.length > 1 && r[0]);

const anchors = [];
const unclassified = [];
const badCoords = [];
const repaired = [];
const seen = new Set();

for (const row of body) {
  const rawName = get(row, 'org_name');
  const tags = classify(row, get);
  if (!tags.length) { unclassified.push(rawName); continue; }

  const coords = normalizeCoords(
    Number.parseFloat(get(row, 'latitude')),
    Number.parseFloat(get(row, 'longitude'))
  );
  if (!coords.ok) { badCoords.push(rawName); continue; }
  if (coords.fixed) repaired.push(rawName);

  const { name, banners } = splitBanners(rawName);

  let id = slug(name);
  if (seen.has(id)) {
    let n = 2;
    while (seen.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  seen.add(id);

  const { address, city } = splitAddress(get(row, 'address'));
  const updates = get(row, 'site_updates');

  // Set-dedupe: the checkbox "By appointment" and the name banner
  // "By appointment only" would otherwise both render as chips.
  const services = [...new Set([
    ...Object.entries(SERVICE_LABELS)
      .filter(([col]) => get(row, col) === 'checked')
      .map(([, label]) => label),
    ...bannerFlags(banners),
  ])].filter((s) => !(s === 'By appointment' && banners.length));

  const transitRaw = get(row, 'public_transit');
  const hours = extractHours(updates);

  const hmis = hmisMatches[id] || null;
  if (hmis) tags.push('hmis');

  anchors.push({
    id,
    name,
    categories: sortCategories(tags),
    address,
    city,
    lat: coords.lat,
    lon: coords.lon,
    phone: extractPhone(updates),
    url: linkOverrides[id] || extractUrl(updates),
    services,
    // Its own field, not a service chip: these strings list up to nine routes.
    transit: transitRaw && transitRaw !== '----' ? transitRaw : null,
    // Verbatim sentences from the listing, not structured times. Null when
    // the listing never states an hour. See extractHours().
    hours,
    neighborhood: get(row, 'neighborhood') || null,
    // { agency, matchedBy } when this site is run by an HMIS agency. The card
    // names the agency so a reader can judge the match themselves.
    hmis: hmis ? { agency: hmis.agency, matchedBy: hmis.matchedBy } : null,
    notes: tidyNotes(updates, hours),
    verification: {
      status: 'stale-import',
      source: 'Twin Cities Mutual Aid Project (TCMAP) public data export',
      lastUpdated: get(row, 'last_updated') || null,
    },
  });
}

anchors.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify(anchors, null, 2) + '\n');

const tally = {};
for (const a of anchors) for (const c of a.categories) tally[c] = (tally[c] || 0) + 1;

console.log(`read       ${body.length} rows`);
console.log(`wrote      ${anchors.length} anchors -> src/data/anchors.json`);
console.log(`tags       ${JSON.stringify(tally)}`);
console.log(`           ${anchors.filter((a) => a.phone).length} with phone, ${anchors.filter((a) => a.url).length} with link`);
console.log(`overrides  ${anchors.filter((a) => linkOverrides[a.id]).length} repaired links applied`);
console.log(`           ${new Set(anchors.map((a) => a.categories.join(' '))).size} distinct tag combinations`);
if (repaired.length) console.log(`repaired   ${repaired.length} flipped longitude: ${repaired.join(', ')}`);
if (badCoords.length) console.log(`dropped    ${badCoords.length} with unusable coordinates: ${badCoords.join(', ')}`);
if (unclassified.length) console.log(`dropped    ${unclassified.length} with no inferable aid type: ${unclassified.join(', ')}`);
