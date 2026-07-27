-- Migration 005: Categorical Request Weather Radar
-- Adds a function that buckets recent CLAIMED events from the activity ledger
-- (a resident claiming a drop is the closest anonymous signal we have to "I
-- need this") into grid cells, split by a coarse need category, so the map
-- can render a "weather radar" style overlay: separate color gradients per
-- category (warmth/food/medical/family) that intensify with local density.
-- Same privacy properties as the existing grid_density_geojson: no per-user
-- tracking, only aggregate counts per grid cell.
-- Idempotent (uses OR REPLACE).

create or replace function category_radar_geojson(
  cell_size double precision default 0.02,
  window_hours double precision default 12
)
returns jsonb
language sql
stable
as $$
  with
    -- Every CLAIMED event's categories, mapped down to one of four radar
    -- buckets. 'general' has no clear thematic bucket and is left out of the
    -- radar (it still shows up as ordinary pins on the map).
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
    -- One point per (cell, category) at the cell's centroid — a heatmap
    -- layer on the client turns these into soft, blurred "radar" blobs.
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
