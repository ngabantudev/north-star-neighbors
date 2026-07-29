/**
 * Liveness check for the official links in anchors.json.
 *
 *   node scripts/verify-links.mjs [--json report.json]
 *
 * This is the cheapest evidence we have that an organization still exists:
 * the TCMAP data is frozen at January 2024, and a domain that no longer
 * resolves is a strong signal the group has wound down. It is evidence, not
 * proof — a live homepage doesn't mean the food shelf is still open, and a
 * dead link doesn't mean the group is gone (plenty operate from Facebook).
 *
 * Deliberately polite: a small concurrency cap, a real User-Agent, HEAD before
 * GET, and no retries beyond one method fallback. These are small nonprofit
 * sites, several self-hosted.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const anchors = JSON.parse(readFileSync(resolve(root, 'src/data/anchors.json'), 'utf8'));

const CONCURRENCY = 8;
const TIMEOUT_MS = 12_000;
const UA = 'north-star-neighbors-link-check/1.0 (civic directory; contact via repo)';

const jsonArg = process.argv.indexOf('--json');
const jsonOut = jsonArg > -1 ? process.argv[jsonArg + 1] : null;

async function probe(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: '*/*' },
    });
    return { status: res.status, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Domain-parking and expired-domain landers answer 200, so a bare status
 * check would score them "alive". These are the ones this dataset hit.
 */
const PARKED_HOST = /expireddomains|sedoparking|parkingcrew|hugedomains|afternic|godaddysites\.com\/expired|namecheap.*parking/i;

async function check(anchor) {
  const url = anchor.url;
  let status = null;
  let finalUrl = null;
  let reason = null;

  try {
    // Some hosts reject HEAD outright; fall back to GET before judging.
    let out = await probe(url, 'HEAD');
    if (out.status >= 400) out = await probe(url, 'GET');
    status = out.status;
    finalUrl = out.finalUrl;
  } catch (err) {
    reason = err.name === 'AbortError' ? 'timeout' : (err.cause?.code || err.code || err.message);
  }

  const base = { id: anchor.id, name: anchor.name, url, status, finalUrl, reason };

  if (status !== null && status < 400) {
    if (finalUrl && PARKED_HOST.test(finalUrl)) return { ...base, verdict: 'parked' };
    const moved = finalUrl && new URL(finalUrl).host !== new URL(url).host;
    return { ...base, verdict: moved ? 'redirected' : 'ok' };
  }

  // A 403 is almost always a bot filter, not a closure. Don't call it death.
  if (status === 403) return { ...base, verdict: 'blocked' };

  // The saved link failed. Does the bare domain still answer? If it does, the
  // organization is probably fine and only the deep path has rotted — which
  // is a link to repair, not a site to drop.
  const origin = new URL(url).origin;
  try {
    let rootOut = await probe(origin, 'HEAD');
    if (rootOut.status >= 400) rootOut = await probe(origin, 'GET');
    if (rootOut.status < 400) {
      if (rootOut.finalUrl && PARKED_HOST.test(rootOut.finalUrl)) {
        return { ...base, verdict: 'parked', rootUrl: origin };
      }
      return { ...base, verdict: 'stale-path', rootUrl: origin, rootStatus: rootOut.status };
    }
    return { ...base, verdict: 'dead-domain', rootStatus: rootOut.status };
  } catch (err) {
    const rootReason = err.name === 'AbortError' ? 'timeout' : (err.cause?.code || err.code || err.message);
    return { ...base, verdict: 'dead-domain', rootReason };
  }
}

/** Fixed-size worker pool over the queue. */
async function run(items, worker, onProgress) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
      onProgress(results.filter(Boolean).length);
    }
  });
  await Promise.all(workers);
  return results;
}

const targets = anchors.filter((a) => a.url);
console.log(`checking ${targets.length} official links (of ${anchors.length} sites)\n`);

let lastLogged = 0;
const results = await run(targets, check, (done) => {
  if (done - lastLogged >= 25 || done === targets.length) {
    lastLogged = done;
    process.stdout.write(`  ${done}/${targets.length}\r`);
  }
});

const by = (v) => results.filter((r) => r.verdict === v);
const ok = by('ok');
const redirected = by('redirected');
const stalePath = by('stale-path');
const blocked = by('blocked');
const parked = by('parked');
const deadDomain = by('dead-domain');

console.log('\n');
console.log(`  ok           ${String(ok.length).padStart(3)}   site answers at the saved URL`);
console.log(`  redirected   ${String(redirected.length).padStart(3)}   moved host, still alive`);
console.log(`  stale-path   ${String(stalePath.length).padStart(3)}   page gone, domain fine — repair the link`);
console.log(`  blocked      ${String(blocked.length).padStart(3)}   403, almost certainly a bot filter`);
console.log(`  parked       ${String(parked.length).padStart(3)}   domain expired or for sale`);
console.log(`  dead-domain  ${String(deadDomain.length).padStart(3)}   nothing answers at all`);
console.log(`  (no link)    ${String(anchors.length - targets.length).padStart(3)}   not checked`);

const alive = ok.length + redirected.length + stalePath.length + blocked.length;
console.log(`\n  ${alive}/${targets.length} show some sign of life; ${parked.length + deadDomain.length} do not.`);

if (parked.length || deadDomain.length) {
  console.log('\nSTRONG evidence the organization is gone:');
  for (const r of [...parked, ...deadDomain]) {
    console.log(`  [${r.verdict}] ${r.name}`);
    console.log(`      ${r.url}${r.finalUrl && r.finalUrl !== r.url ? `\n      -> ${r.finalUrl}` : ''}`);
  }
}

if (stalePath.length) {
  console.log(`\nLink rot — domain is alive, saved page is not (${stalePath.length}):`);
  for (const r of stalePath) console.log(`  ${String(r.status ?? r.reason).padEnd(10)} ${r.name}\n             ${r.url}`);
}

if (redirected.length) {
  console.log('\nRedirected to another host:');
  for (const r of redirected) console.log(`  ${r.name}\n    ${r.url}\n    -> ${r.finalUrl}`);
}

if (jsonOut) {
  writeFileSync(resolve(root, jsonOut), JSON.stringify(results, null, 2) + '\n');
  console.log(`\nfull report -> ${jsonOut}`);
}
