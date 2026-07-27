-- north-star-neighbors schema
-- Run against a Neon Postgres database. Requires the postgis extension.

create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- Pre-approved public/civic zones. Drops must be anchored to one of these
-- rather than an arbitrary (potentially private-residence) coordinate.
-- Nationwide coverage comes from a live OSM Overpass lookup (src/lib/overpass.ts);
-- each anchor actually used gets upserted here by osm_id, both as a cache and
-- so `drops.anchor_id` keeps a real foreign key to reference.
create table if not exists civic_anchors (
  id uuid primary key default gen_random_uuid(),
  osm_id text unique,
  name text not null,
  category text not null check (category in ('library', 'transit_hub', 'community_center', 'park_plaza', 'fire_station', 'grocery')),
  address text,
  location geography(point, 4326) not null
);

create index if not exists civic_anchors_location_idx on civic_anchors using gist (location);

create table if not exists drops (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references civic_anchors(id),
  location geography(point, 4326) not null,
  categories text[] not null,
  details text check (char_length(details) <= 140),
  -- Required (enforced in createDrop) visual confirmation of the supplies.
  -- Re-encoded client-side (strips EXIF/GPS) before upload; purged
  -- automatically with the row on complete/cancel/expire.
  photo bytea,
  photo_content_type text,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'CLAIMED', 'COMPLETED', 'HIDDEN')),
  provider_handle text not null,
  provider_token_hash text not null,
  claimant_handle text,
  claimant_token_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists drops_location_idx on drops using gist (location);
create index if not exists drops_status_idx on drops (status);
create index if not exists drops_expires_at_idx on drops (expires_at);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops(id) on delete cascade,
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (drop_id, device_hash)
);

-- Aggregate, pseudonymous trust score. Keyed by a hash of the client-held
-- reputation token so no PII or stable device identifier is stored.
create table if not exists reputation (
  handle_token_hash text primary key,
  handle text not null,
  positive_count int not null default 0,
  negative_count int not null default 0,
  completed_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Lightweight rolling-window rate limiting, keyed by a client-held device
-- hash (never a raw IP or fingerprint persisted long-term).
create table if not exists request_log (
  id bigserial primary key,
  actor_hash text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_log_actor_action_idx on request_log (actor_hash, action, created_at);

-- Immutable append-only audit ledger: every state transition is recorded here
-- cryptographically pinned to a pseudonymous handle and high-precision timestamp.
-- Never updated, never deleted. Powers the public activity feed.
create table if not exists activity_ledger (
  id bigserial primary key,
  actor_handle text not null,
  event_type text not null check (event_type in (
    'DROPPED', 'CLAIMED', 'FULFILLED', 'CANCELED', 'FLAGGED', 'HIDDEN', 'EXPIRED'
  )),
  drop_id uuid not null,
  anchor_name text,
  categories text[],
  details_hash text,            -- SHA-256 of the plaintext details; reproducible without storing raw text
  event_metadata jsonb,         -- extensible bag: TTL minutes, flag count, rating, etc.
  occurred_at timestamptz not null default now()
);

create index if not exists activity_ledger_occurred_at_idx
  on activity_ledger (occurred_at desc);
create index if not exists activity_ledger_anchor_idx
  on activity_ledger (anchor_name);
create index if not exists activity_ledger_event_type_idx
  on activity_ledger (event_type);

-- Database-side self-cleaning TTL triggers: every write to drops triggers
-- atomic cleanup of expired rows. Also prunes request_log to a rolling 24h.
create or replace function cleanup_expired_drops()
returns trigger
language plpgsql
as $$
begin
  delete from drops where expires_at < now();
  return null;
end;
$$;

drop trigger if exists trg_cleanup_expired_drops_insert on drops;
create trigger trg_cleanup_expired_drops_insert
  after insert on drops
  for each statement
  execute function cleanup_expired_drops();

drop trigger if exists trg_cleanup_expired_drops_update on drops;
create trigger trg_cleanup_expired_drops_update
  after update on drops
  for each statement
  execute function cleanup_expired_drops();

create or replace function cleanup_old_request_log()
returns trigger
language plpgsql
as $$
begin
  delete from request_log where created_at < now() - interval '24 hours';
  return null;
end;
$$;

drop trigger if exists trg_cleanup_old_request_log on request_log;
create trigger trg_cleanup_old_request_log
  after insert on request_log
  for each statement
  execute function cleanup_old_request_log();

-- Seed: well-known public civic anchors across the Twin Cities metro.
-- Coordinates are approximate landmark locations, not exact building entries.
-- These have no osm_id, so there's no unique constraint to key an `on conflict`
-- off of — guard against re-running this file with a name check instead.
insert into civic_anchors (name, category, address, location)
select v.name, v.category, v.address, v.location
from (
  values
    ('Minneapolis Central Library', 'library', '300 Nicollet Mall, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2723, 44.9773), 4326)::geography),
    ('East Lake Library', 'library', '2727 E Lake St, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2478, 44.9484), 4326)::geography),
    ('Saint Paul Central Library', 'library', '90 W 4th St, Saint Paul, MN', ST_SetSRID(ST_MakePoint(-93.0958, 44.9445), 4326)::geography),
    ('Rondo Community Outreach Library', 'library', '461 N Dale St, Saint Paul, MN', ST_SetSRID(ST_MakePoint(-93.1180, 44.9556), 4326)::geography),
    ('Union Depot', 'transit_hub', '214 4th St E, Saint Paul, MN', ST_SetSRID(ST_MakePoint(-93.0879, 44.9486), 4326)::geography),
    ('Nicollet Mall Station', 'transit_hub', 'Nicollet Mall, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2707, 44.9757), 4326)::geography),
    ('Franklin Avenue Station', 'transit_hub', '31 Franklin Ave W, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2465, 44.9625), 4326)::geography),
    ('Brian Coyle Community Center', 'community_center', '420 15th Ave S, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2477, 44.9686), 4326)::geography),
    ('Government Plaza', 'park_plaza', '300 S 6th St, Minneapolis, MN', ST_SetSRID(ST_MakePoint(-93.2654, 44.9772), 4326)::geography),
    ('Brooklyn Park Community Activity Center', 'community_center', '5600 85th Ave N, Brooklyn Park, MN', ST_SetSRID(ST_MakePoint(-93.3599, 45.1017), 4326)::geography),
    ('Coon Rapids Community Center', 'community_center', '11155 Robinson Dr NW, Coon Rapids, MN', ST_SetSRID(ST_MakePoint(-93.3030, 45.1732), 4326)::geography)
) as v(name, category, address, location)
where not exists (select 1 from civic_anchors existing where existing.name = v.name);

-- ---------------------------------------------------------------------------
-- Real-Time Transaction Density & Demand-Supply Indexing
-- A PostGIS-first aggregation function that buckets drop/claim activity into
-- spatial grid cells. Returns a GeoJSON FeatureCollection ready for MapLibre
-- with zero client-side math. See /api/density/grid for the HTTP endpoint.
-- ---------------------------------------------------------------------------

create or replace function grid_density_geojson(
  cell_size double precision default 0.01,
  demand_window_hours double precision default 4
)
returns jsonb
language sql
stable
as $$
  with
    supply as (
      select
        ST_SnapToGrid(d.location::geometry, cell_size) as cell_geom,
        count(*)::int as supply_count
      from drops d
      where d.status = 'AVAILABLE' and d.expires_at > now()
      group by cell_geom
    ),
    demand as (
      select
        ST_SnapToGrid(ca.location::geometry, cell_size) as cell_geom,
        count(*)::int as demand_count
      from activity_ledger al
      join civic_anchors ca on ca.name = al.anchor_name
      where al.event_type = 'CLAIMED'
        and al.occurred_at > now() - (demand_window_hours * interval '1 hour')
      group by cell_geom
    ),
    merged as (
      select
        coalesce(s.cell_geom, d.cell_geom) as cell_geom,
        coalesce(s.supply_count, 0) as supply_count,
        coalesce(d.demand_count, 0) as demand_count
      from supply s
      full outer join demand d on s.cell_geom = d.cell_geom
    ),
    features as (
      select jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(
          ST_MakeEnvelope(
            ST_X(cell_geom),
            ST_Y(cell_geom),
            ST_X(cell_geom) + cell_size,
            ST_Y(cell_geom) + cell_size,
            4326
          )
        )::jsonb,
        'properties', jsonb_build_object(
          'supplyCount', supply_count,
          'demandCount', demand_count,
          'demandSupplyRatio',
            case when supply_count > 0
              then round((demand_count::numeric / supply_count)::numeric, 2)
              when demand_count > 0 then 999
              else 0
            end
        )
      ) as feature
      from merged
      where supply_count > 0 or demand_count > 0
    )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
  )
  from features;
$$;

-- ---------------------------------------------------------------------------
-- Categorical Request Weather Radar
-- Buckets recent CLAIMED events (the closest anonymous signal we have to "a
-- resident needed this") into grid-cell centroid points, split by a coarse
-- need category (warmth/food/medical/family), for a per-category heatmap
-- overlay. See db/migrations/005_category_request_radar.sql and
-- /api/density/radar for the HTTP endpoint.
-- ---------------------------------------------------------------------------

create or replace function category_radar_geojson(
  cell_size double precision default 0.02,
  window_hours double precision default 12
)
returns jsonb
language sql
stable
as $$
  with
    requests as (
      select
        ST_SnapToGrid(ca.location::geometry, cell_size) as cell_geom,
        case cat
          when 'coats' then 'warmth'
          when 'produce' then 'food'
          when 'water' then 'food'
          when 'medical' then 'medical'
          when 'baby' then 'family'
          else null
        end as radar_category
      from activity_ledger al
      join civic_anchors ca on ca.name = al.anchor_name
      cross join lateral unnest(al.categories) as cat
      where al.event_type = 'CLAIMED'
        and al.occurred_at > now() - (window_hours * interval '1 hour')
    ),
    counted as (
      select cell_geom, radar_category, count(*)::int as request_count
      from requests
      where radar_category is not null
      group by cell_geom, radar_category
    ),
    features as (
      select jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(
          ST_SetSRID(
            ST_MakePoint(
              ST_X(cell_geom) + cell_size / 2,
              ST_Y(cell_geom) + cell_size / 2
            ),
            4326
          )
        )::jsonb,
        'properties', jsonb_build_object(
          'radarCategory', radar_category,
          'requestCount', request_count
        )
      ) as feature
      from counted
    )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
  )
  from features;
$$;
