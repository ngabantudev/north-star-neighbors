-- Migration 004: Remove the anchor-level density view.
-- Product decision: keep grid density, drop the per-anchor demand-supply
-- view added in migration 002. The civic_anchors table and the anchor
-- matching/snapping system used by drop creation are untouched — this only
-- removes the density *visualization* that aggregated by anchor.
-- Idempotent: safe to re-run.

drop function if exists anchor_density_geojson(double precision);
