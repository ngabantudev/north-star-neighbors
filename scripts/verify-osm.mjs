/**
 * Cross-checks every address in anchors.json against OpenStreetMap.
 *
 *   node scripts/verify-osm.mjs [--json report.json]
 *
 * Answers one question: does this address resolve to a real place, and is it
 * where the CSV says it is? It geocodes each address with Nominatim and
 * measures the distance to the stored coordinates.
 *
 * WHAT THIS DOES NOT TELL YOU: whether the organization still operates. OSM
 * knows about buildings, not about whether a food shelf inside one closed in
 * 2024. An address that resolves cleanly can still be a shut door. Treat a
 * pass as "the location is real", never as "the site is open".
 *
 * Nominatim is a donated public service. Its usage policy caps this at one
 * request per second with an identifying User-Agent, so a full run over 323
 * records takes about six minutes. Do not raise the rate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const anchors = JSON.parse(readFileSync(resolve(root, 'src/data/anchors.json'), 'utf8'));

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const UA = 'north-star-neighbors-address-check/1.0 (civic aid directory; contact via repo)';
const RATE_MS = 1100; // Nominatim policy: <= 1 req/sec. Leave headroom.
const NEAR_M = 250;   // Same building or block.
const FAR_M = 2000;   // Beyond this the stored point is probably wrong.

const jsonArg = process.argv.indexOf('--json');
const jsonOut = jsonArg > -1 ? process.argv[jsonArg + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Haversine, metres. */
function distance(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

async function geocode(query) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (res.status === 429) throw new Error('rate-limited by Nominatim — slow down');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = await res.json();
  return hits[0] || null;
}

async function check(anchor) {
  const query = [anchor.address, anchor.city].filter(Boolean).join(', ');
  const base = { id: anchor.id, name: anchor.name, query };

  let hit;
  try {
    hit = await geocode(query);
  } catch (err) {
    return { ...base, verdict: 'error', reason: err.message };
  }

  if (!hit) return { ...base, verdict: 'not-found' };

  const metres = distance(anchor.lat, anchor.lon, Number(hit.lat), Number(hit.lon));
  const verdict = metres <= NEAR_M ? 'match' : metres <= FAR_M ? 'nearby' : 'mismatch';

  return {
    ...base,
    verdict,
    metres,
    osmType: hit.category ? `${hit.category}/${hit.type}` : null,
    osmName: hit.display_name,
  };
}

console.log(`geocoding ${anchors.length} addresses against OpenStreetMap`);
console.log(`at ${RATE_MS}ms intervals — about ${Math.ceil((anchors.length * RATE_MS) / 60000)} minutes\n`);

const results = [];
for (const [i, anchor] of anchors.entries()) {
  results.push(await check(anchor));
  if ((i + 1) % 25 === 0 || i + 1 === anchors.length) {
    process.stdout.write(`  ${i + 1}/${anchors.length}\r`);
  }
  if (i + 1 < anchors.length) await sleep(RATE_MS);
}

const by = (v) => results.filter((r) => r.verdict === v);
const match = by('match');
const nearby = by('nearby');
const mismatch = by('mismatch');
const notFound = by('not-found');
const errored = by('error');

console.log('\n');
console.log(`  match      ${String(match.length).padStart(3)}   resolves within ${NEAR_M}m of the stored point`);
console.log(`  nearby     ${String(nearby.length).padStart(3)}   ${NEAR_M}m–${FAR_M}m off`);
console.log(`  mismatch   ${String(mismatch.length).padStart(3)}   over ${FAR_M}m off — stored point is suspect`);
console.log(`  not-found  ${String(notFound.length).padStart(3)}   OSM can't resolve the address`);
console.log(`  error      ${String(errored.length).padStart(3)}`);

if (mismatch.length) {
  console.log('\nStored coordinates disagree with the address:');
  for (const r of mismatch.sort((a, b) => b.metres - a.metres)) {
    console.log(`  ${String(`${(r.metres / 1000).toFixed(1)}km`).padStart(8)}  ${r.name}`);
    console.log(`            csv: ${r.query}`);
    console.log(`            osm: ${r.osmName}`);
  }
}

if (notFound.length) {
  console.log('\nOSM could not resolve these addresses:');
  for (const r of notFound) console.log(`  ${r.name}\n    ${r.query}`);
}

console.log('\nReminder: this checks that the address is real, not that the site is open.');

if (jsonOut) {
  writeFileSync(resolve(root, jsonOut), JSON.stringify(results, null, 2) + '\n');
  console.log(`full report -> ${jsonOut}`);
}
