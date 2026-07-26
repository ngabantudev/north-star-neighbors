# North Star Neighbors

Anonymous, map-first mutual aid logistics for post-disruption recovery in the
Twin Cities. Providers drop supply pins at pre-approved public sites;
receivers claim and complete pickups through a fixed state machine — no
chat, no phone numbers, no PII.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) · TypeScript
- **[MapLibre GL JS](https://maplibre.org)** via free **[OpenFreeMap](https://openfreemap.org)**
  vector tiles — no API key, no Google Maps
- **[Neon](https://neon.tech) Postgres + PostGIS** — spatial queries (nearest
  civic anchor, radius search) and the `bytea` supply-photo storage
- **Tailwind CSS v4** with a palette matched to [mn.gov](https://mn.gov)'s own
  branding (header blue `#003865`, link blue `#0062b2`, accent green
  `#71bf43`), body font **Open Sans** to match
- **[shadcn/ui](https://ui.shadcn.com)** on **[Base UI](https://base-ui.com)**
  primitives (Dialog, ToggleGroup, Button, Input, Badge, Sonner toasts) —
  this project's shadcn registry defaults to Base UI rather than Radix
- **[react-hook-form](https://react-hook-form.com) + [zod](https://zod.dev)**
  for the drop-supplies form
- **[nsfwjs](https://github.com/infinitered/nsfwjs)** (TensorFlow.js) — client-side,
  self-hosted content check on any attached photo before upload; the model
  weights live in `public/nsfwjs-model/` so nothing is fetched from a
  third-party CDN and no image ever leaves the browser for this check
- **[Nominatim](https://nominatim.org)** (OpenStreetMap) — free reverse
  geocoding fallback (street/neighborhood context) when no approved civic
  anchor is in range, proxied server-side in `/api/geocode/reverse`
- **[Lucide](https://lucide.dev)** icons — used for the pseudonymous
  animal+color avatar system (see below)

## Setup

1. Create a [Neon](https://neon.tech) project and enable nothing extra —
   the schema below enables the `postgis` extension itself.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`.
3. Load the schema (tables + seed civic anchors) via the Neon SQL Editor, or:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

## State machine

```
AVAILABLE --claim--> CLAIMED --complete--> (purged + rating)
    |                    |
    +------cancel--------+---> (purged, "Cancel & Alert")

flag x3 distinct devices --> HIDDEN
countdown hits zero (client-triggered) or cron sweep --> purged
```

Every transition is a single atomic `UPDATE ... WHERE status = 'X' RETURNING`
statement (see `src/app/actions.ts`), so two simultaneous claims on the same
pin can't both succeed — Postgres row-level locking decides the winner and
the loser gets an "already claimed" error.

**TTL is currently set to 1/3-minute test values** (`src/lib/types.ts`,
`TTL_OPTIONS`) so expiry and auto-purge are easy to watch happen live. Swap
to real values (2h/4h/end-of-day) before shipping — the comment at that
constant has the exact replacement.

## Identity & avatars

On first visit the browser generates a random token, stored only in
`localStorage` — no account, email, or password involved. That token is:

- **The ownership credential** — its hash is what the server checks to
  authorize editing, claiming, canceling, or completing a pin.
- **The reputation key** — the same hash is the primary key for that
  browser's aggregate trust-score row.
- **The avatar seed** — deterministically hashed into an animal + color
  combination (`src/lib/avatar.ts`), e.g. "Blue Loon" or "Green Squirrel".
  Same device always gets the same avatar; two different devices reliably
  get different combinations. Lucide's icon set has no dedicated
  wolf/bear/moose/loon glyphs (checked Tabler, Phosphor, and Iconoir too —
  none have a real Minnesota-wildlife set), so the roster maps to the
  closest available icons (e.g. `Bird` → "Loon", `PawPrint` → "Timber Wolf").

A separate, unrelated random `deviceId` (also localStorage-only) is sent
with mutating requests purely for rate limiting and duplicate-flag
detection. It is not derived from browser/canvas/device fingerprinting.

**Known limitation, by design:** clearing localStorage resets a user's
identity, reputation, and avatar. This is inherent to any anonymous,
client-held identity — there is no way to make an identity survive a
deliberate reset without either device fingerprinting (a real privacy
regression) or requiring a real account (reintroducing PII). Anonymity and
un-resettable accountability are mutually exclusive; this project takes
anonymity. Abuse resistance instead comes from the device-hash rate limiter
and the community flag/report circuit breaker below.

## Supply photos

Attaching a photo is optional. When one is attached:

1. It's resized/recompressed through a `<canvas>` client-side
   (`src/lib/imageCompress.ts`) — this also strips EXIF/GPS/device metadata
   as a side effect of the re-encode, before the file ever leaves the device.
2. It's checked against the self-hosted NSFWJS model client-side
   (`src/lib/nsfwCheck.ts`) and rejected before upload if flagged.
3. It's stored as `bytea` directly on the `drops` row (not a separate object
   store) and served back via `/api/drops/[id]/photo`.

Because it lives on the same row as the rest of the drop, the photo is
purged automatically the moment that row is — on complete, cancel, or
expiry. Nothing about a drop outlives the drop itself.

NSFWJS only catches sexual/explicit content — it's not general "illicit
content" moderation (weapons, drugs, etc. aren't in its training classes).
The flag/report circuit breaker below is the backstop for anything it
doesn't catch.

## Safety & abuse mitigation

- **Anchor-restricted placement**: drops can only be placed at one of the
  pre-seeded `civic_anchors` (libraries, transit hubs, community centers) —
  never an arbitrary coordinate. Enforced both by only ever offering the
  nearest approved anchor (no free placement UI) and by re-validating
  distance server-side in `createDrop`.
- **Rate limiting**: a rolling-window check per device hash
  (`src/lib/rateLimit.ts`) on create/claim/flag/complete.
- **Community flag circuit breaker**: 3 flags from distinct device hashes
  auto-hides a pin (`FLAG_THRESHOLD` in `src/app/actions.ts`).
- **Emergency retraction**: "Cancel & Alert" immediately deletes a pin's row,
  available to either party at any state.

## Cron: TTL expiry backstop

The countdown hitting zero in an open browser tab triggers immediate,
server-revalidated deletion (`expireDrop` in `src/app/actions.ts`) — that's
the primary path. `vercel.json` also schedules `GET /api/cron/expire` every
10 minutes as a backstop for drops that expire while no one has the map
open. Set `CRON_SECRET` as a Vercel project env var and Vercel signs the
request automatically; the route checks it if present, and runs
unauthenticated if left unset (fine for local/dev, set it before deploying
publicly).

## Data retention

Completed/cancelled/expired drops (including their photo) are fully deleted,
not archived. There's no per-drop history table. If you want impact metrics
("N pickups completed this month") without reintroducing a record of who-did-
what-where, the right pattern is an anonymous aggregate counter incremented
at deletion time — not retaining the rows. Not built yet; ask if you want it.

## Known MVP simplifications

- "Broadcast a cancellation notice to the network" is realized via polling
  (the map re-fetches every 6s) rather than push (WebSockets/SSE) — a
  cancelled or claimed pin disappears within one poll cycle, not instantly
  (expiry is the exception — see above, that's push-like via the client timer).
- Reputation is a simple positive/negative/completed counter, not a 1–5
  star average, per the spec's "lightweight" framing.
- Civic anchor seed data covers a handful of well-known Twin Cities public
  sites; add more rows to `civic_anchors` in `db/schema.sql` for full
  coverage.
- The reverse-geocode fallback (`/api/geocode/reverse`) is informational
  only — it never expands *where* a pin can be placed, only explains why no
  anchor was found nearby.
# north-star-neighbors
