-- Migration 006: Public transaction ledger — drill-down context + bounded retention.
-- The append-only `activity_ledger` from migration 001 already records every
-- state transition, but only DROPPED events carried the zone/category context.
-- The public drill-down needs that context on every event, so this adds a
-- `location_type` column (so curbside events can be rendered as a masked block
-- rather than a named public site) and the indexes the feed queries need.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. DRILL-DOWN CONTEXT
-- Nullable: pre-existing rows (and any event we can't attribute to a drop
-- shape) simply render without a location badge.
-- ---------------------------------------------------------------------------
alter table activity_ledger add column if not exists location_type text;

alter table activity_ledger drop constraint if exists activity_ledger_location_type_check;
alter table activity_ledger add constraint activity_ledger_location_type_check
  check (location_type is null or location_type in ('anchor', 'curbside'));

-- One-time backfill of the new column only. This does not rewrite any recorded
-- event content, so the ledger's append-only guarantee still holds: curbside
-- DROPPED events already stashed their shape in event_metadata, and anything
-- with an anchor_name was by definition an anchor drop.
update activity_ledger
set location_type = coalesce(
  event_metadata->>'locationType',
  case when anchor_name is not null then 'anchor' end
)
where location_type is null;

-- ---------------------------------------------------------------------------
-- 2. FEED INDEXES
-- The public feed is a keyset-paginated (occurred_at desc, id desc) scan; the
-- drill-down drawer pulls the full event chain for one drop.
-- ---------------------------------------------------------------------------
create index if not exists activity_ledger_feed_idx
  on activity_ledger (occurred_at desc, id desc);
create index if not exists activity_ledger_drop_id_idx
  on activity_ledger (drop_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 3. BOUNDED RETENTION
-- "Zero permanent digital footprint" has to apply to the ledger too, otherwise
-- publishing it turns a 24-hour app into a permanent public activity archive.
-- Same statement-level self-cleaning pattern as request_log: every append
-- prunes anything past the window. 24h also covers both density windows
-- (grid_density_geojson = 4h, category_radar_geojson = 12h).
-- Keep in sync with LEDGER_WINDOW_HOURS in src/lib/ledger.ts.
-- ---------------------------------------------------------------------------
create or replace function cleanup_old_activity_ledger()
returns trigger
language plpgsql
as $$
begin
  delete from activity_ledger where occurred_at < now() - interval '24 hours';
  return null;
end;
$$;

drop trigger if exists trg_cleanup_old_activity_ledger on activity_ledger;
create trigger trg_cleanup_old_activity_ledger
  after insert on activity_ledger
  for each statement
  execute function cleanup_old_activity_ledger();
