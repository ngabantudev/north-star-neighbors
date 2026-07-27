# North Star Neighbors

> **Absolute street-level survival logistics, maximum privacy and safety for vulnerable folks, and zero liability.** No invasive tracking, no user PII collection, and zero compromises on community safety. The app should feel playful, active, and alive—like discovering kindness in action.

Anonymous, map-first mutual aid logistics for post-disruption recovery in the Twin Cities. Providers drop supply pins at pre-approved public sites; receivers claim and complete pickups through a fixed state machine—**no chat, no phone numbers, no PII.**

---

## ⚡ Core Philosophy & Directives

* **Zero-PII Architecture:** No emails, passwords, or phone numbers. Users are automatically assigned secure, device-local cryptographic passkeys mapped to pseudonymous handles (e.g., `Blue-Badger-402`).
* **Spatial Privacy Boundaries:** PostGIS geographic constraints restrict pins strictly to pre-approved public civic zones or masked regional perimeters, keeping private residential addresses off the map entirely.
* **Self-Cleaning Data (TTL & Cost Optimization):** Automated database triggers purge or archive expired listings, shift logs, and transient transaction records within a strict 24-hour window. This ensures zero permanent digital footprint while reducing cloud storage, backup, and compute costs.
* **Offline-First PWA:** Utilizes service workers and IndexedDB caching for vector tiles, map styles, and local session states, allowing unhoused or digitally disconnected individuals to view cached maps and log local needs without data plans.

---

## 🗺️ How It Works & Key Features

1. **Playful Onboarding & "Live Ripple":** An engaging first-load experience featuring soft organic category ripples across the map and a terminal-style dispatch card introducing the user's random animal handle (`Blue-Badger-402`) with a tone of radical privacy and camaraderie.
2. **Categorical Request Weather Radar:** An opt-in map overlay (off by default) driven strictly by anonymous resident requests, aggregating data into category-specific color gradients (Blue for Warmth, Orange for Food, Green for Medical, Magenta for Family Care) that intensify based on local request density.
3. **Hybrid Hubs & Curbside "Dead Drops":** Providers can choose between vetted public civic anchors (libraries, transit stops) or local residential curbside drop points. Curbside drops automatically apply a secure spatial address masking offset to protect private home addresses.
4. **One-Tap Mode Selector & Shortest-Path Routing:** When claiming a drop, users instantly select their transport mode (`🚶 Walking`, `🚲 Biking`, `🚗 Rolling`) to draw a privacy-respecting shortest-path route without tracking device sensors.
5. **Institutional Anchor Integration:** Pre-vetted permanent community organizations (food shelves, shelters) map directly into the base layer via static configurations with operating hours, bulk stock metadata, and automated overflow routing.

---

## 🛠️ Technology Stack

* **Full-Stack Foundation:** **Next.js 16** (App Router, Turbopack) & **TypeScript** across the entire codebase.
* **Database & Spatial Intelligence:** **Neon Postgres + PostGIS** for high-performance spatial grid aggregation, bounding-box snapping, nearest-anchor queries, and automated TTL cleanup triggers.
* **Mapping:** **MapLibre GL JS** via free **OpenFreeMap** vector tiles—no API key, no Google Maps.
* **Styling & UI Components:** **Tailwind CSS v4** (matched to `mn.gov` branding: header blue `#003865`, link blue `#0062b2`, accent green `#71bf43`, body font **Open Sans**) combined with **shadcn/ui** on **Base UI** primitives.
* **Forms & Validation:** **react-hook-form** + **zod**.
* **Client-Side Security:** Self-hosted **nsfwjs** (TensorFlow.js) model running locally in-browser for image content checks, alongside client-side canvas re-encoding to strip all EXIF/GPS metadata before upload.
* **Geocoding & Icons:** **Nominatim** (OpenStreetMap) for reverse-geocoding fallback, and **Lucide** icons for the pseudonymous animal+color avatar system.

---

## Setup

1. Create a [Neon](https://neon.tech) project and enable the `postgis` extension via schema execution.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`.
3. Load the schema (tables + seed civic anchors):
```bash
psql "$DATABASE_URL" -f db/schema.sql

```


4. Install and run:
```bash
npm install
npm run dev

```



---

## State machine

```
Provider creates:  --> AVAILABLE 
                         │     │
       Receiver claims:  │     └──> CLAIMED --complete--> (purged + rating)
                         │              │
    Receiver cancels:    │              └──> (reverts to AVAILABLE + original TTL)
                         │
    Provider cancels:    └──> (purged immediately, "Cancel & Alert")

flag x3 distinct devices --> HIDDEN
countdown hits zero (client-triggered) or cron sweep --> purged

```

Every transition is a single atomic `UPDATE ... WHERE status = 'X' RETURNING` statement (`src/app/actions.ts`), preventing race conditions. TTL is currently set to test values (`src/lib/types.ts`, `TTL_OPTIONS`) for live verification.

---

## Identity & avatars

On first visit, the browser generates a random token stored exclusively in `localStorage`—no account, email, or password involved.

* **The ownership credential** for editing, claiming, canceling, or completing a pin.
* **The reputation key** for the browser's aggregate trust-score row.
* **The avatar seed** mapped deterministically to a Minnesota wildlife animal + color combination (`src/lib/avatar.ts`), e.g., "Blue Loon" or "Green Squirrel".

A separate random `deviceId` handles rate-limiting and duplicate-flag detection without browser fingerprinting. Clearing `localStorage` resets identity by design to preserve absolute anonymity.

---

## Supply photos

Attaching a photo is required:

1. Resized and recompressed client-side via `<canvas>` (`src/lib/imageCompress.ts`), stripping all EXIF/GPS metadata before leaving the device.
2. Verified locally against the self-hosted NSFWJS model (`src/lib/nsfwCheck.ts`).
3. Stored as `bytea` on the `drops` row and served via `/api/drops/[id]/photo`, ensuring it is purged automatically the moment the row is deleted.

---

## Safety & abuse mitigation

* **Anchor & Masked Placement:** Pins restricted to pre-approved civic anchors or secure, fuzzed curbside perimeters.
* **Rate Limiting:** Rolling-window check per device hash (`src/lib/rateLimit.ts`).
* **Community Flag Circuit Breaker:** 3 flags from distinct device hashes auto-hide a pin (`FLAG_THRESHOLD` in `src/app/actions.ts`).
* **Emergency Retraction:** "Cancel & Alert" immediately deletes a pin's row at any state.
