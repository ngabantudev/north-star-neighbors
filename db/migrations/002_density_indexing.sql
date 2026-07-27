-- Migration 002: Real-Time Transaction Density & Demand-Supply Indexing
-- Creates spatial aggregation functions that bucket drop/claim activity into
-- grid sectors or neighborhood zones — no per-user tracking, profiling, or
-- labeling. Powers the dynamic demand-supply heatmap overlay on the map.
-- Run against the existing database. Idempotent (uses OR REPLACE).

-- ---------------------------------------------------------------------------
-- 1. GRID-CELL DENSITY (GeoJSON-ready)
--    ST_SnapToGrid divides the map into uniform cells. Cell size is
--    configurable at query time; ~0.01° ≈ 1.1 km at this latitude.
--    Returns a GeoJSON FeatureCollection where each feature is a grid cell
--    polygon with supply (active AVAILABLE drops) and demand (recent CLAIMED
--    events from the append-only ledger) counts + a demand/supply ratio.
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
    -- Active supply: AVAILABLE drops that haven't expired, snapped to grid.
    supply as (
      select
        ST_SnapToGrid(d.location::geometry, cell_size) as cell_geom,
        count(*)::int as supply_count
      from drops d
      where d.status = 'AVAILABLE' and d.expires_at > now()
      group by cell_geom
    ),
    -- Recent demand: CLAIMED events from the activity ledger, spatially
    -- joined through civic_anchors by name (the ledger stores anchor_name).
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
    -- Full outer join so we see cells with only supply or only demand.
    merged as (
      select
        coalesce(s.cell_geom, d.cell_geom) as cell_geom,
        coalesce(s.supply_count, 0) as supply_count,
        coalesce(d.demand_count, 0) as demand_count
      from supply s
      full outer join demand d on s.cell_geom = d.cell_geom
    ),
    -- Build GeoJSON polygon for each cell from the snapped point.
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
              when demand_count > 0 then 999  -- demand with no supply = hot zone
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
-- 2. ANCHOR-LEVEL DENSITY (neighborhood zones)
--    Aggregates supply and demand at the civic-anchor level instead of raw
--    grid cells. More human-readable — each point on the map corresponds to
--    a named public place (library, transit hub, etc.).
--    Returns GeoJSON FeatureCollection with anchor points + density props.
-- ---------------------------------------------------------------------------
create or replace function anchor_density_geojson(
  demand_window_hours double precision default 4
)
returns jsonb
language sql
stable
as $$
  with
    supply as (
      select
        d.anchor_id,
        count(*)::int as supply_count
      from drops d
      where d.status = 'AVAILABLE' and d.expires_at > now()
      group by d.anchor_id
    ),
    demand as (
      select
        ca.id as anchor_id,
        count(*)::int as demand_count
      from activity_ledger al
      join civic_anchors ca on ca.name = al.anchor_name
      where al.event_type = 'CLAIMED'
        and al.occurred_at > now() - (demand_window_hours * interval '1 hour')
      group by ca.id
    ),
    features as (
      select jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(ca.location::geometry)::jsonb,
        'properties', jsonb_build_object(
          'anchorId', ca.id,
          'anchorName', ca.name,
          'anchorCategory', ca.category,
          'supplyCount', coalesce(s.supply_count, 0),
          'demandCount', coalesce(d.demand_count, 0),
          'demandSupplyRatio',
            case when coalesce(s.supply_count, 0) > 0
              then round((coalesce(d.demand_count, 0)::numeric / s.supply_count)::numeric, 2)
              when coalesce(d.demand_count, 0) > 0 then 999
              else 0
            end
        )
      ) as feature
      from civic_anchors ca
      left join supply s on s.anchor_id = ca.id
      left join demand d on d.anchor_id = ca.id
      where coalesce(s.supply_count, 0) > 0 or coalesce(d.demand_count, 0) > 0
    )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
  )
  from features;
$$;
