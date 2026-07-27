-- Migration 003: Add 'grocery' as a valid civic_anchors category.
-- Grocery stores (OSM shop=supermarket/convenience) are common, widely
-- distributed, already-public places — same anonymity property as a library:
-- many unrelated people are plausibly near one at any time.
-- Idempotent: safe to re-run.

alter table civic_anchors drop constraint if exists civic_anchors_category_check;

alter table civic_anchors add constraint civic_anchors_category_check
  check (category in ('library', 'transit_hub', 'community_center', 'park_plaza', 'fire_station', 'grocery'));
