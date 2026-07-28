-- Migration 005: Hybrid Hub & Curbside "Dead Drop" Engine.
-- Lets a drop be anchored either to a pre-approved public civic_anchors row
-- (existing behavior) or to a residential curbside point. Curbside drops
-- never expose the real coordinate: `location` holds a block-grid-fuzzed
-- point (what the public map and every API response show), while the real
-- pickup coordinate lives in `exact_location` and is only ever read by the
-- drop's own createDrop/getExactLocation server actions for the provider or
-- the claimant who has already claimed it. Idempotent: safe to re-run.

alter table drops alter column anchor_id drop not null;

alter table drops add column if not exists location_type text not null default 'anchor'
  check (location_type in ('anchor', 'curbside'));

alter table drops add column if not exists exact_location geography(point, 4326);

alter table drops drop constraint if exists drops_location_type_shape_check;
alter table drops add constraint drops_location_type_shape_check check (
  (location_type = 'anchor' and anchor_id is not null and exact_location is null)
  or
  (location_type = 'curbside' and anchor_id is null and exact_location is not null)
);
