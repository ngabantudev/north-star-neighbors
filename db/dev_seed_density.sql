-- LOCAL DEV ONLY — sample data for eyeballing the density overlay.
-- Not a numbered migration; do not run this against a production database.
-- Every row is tagged with provider_handle/actor_handle 'seed-density-test'
-- so it's trivial to find and remove later — see the DELETE statements at
-- the bottom of this file (commented out).
--
-- Creates four scenarios, one per legend color:
--   Minneapolis Central Library  -> well supplied (green): supply only
--   East Lake Library            -> balanced (amber): supply ~= demand
--   Brian Coyle Community Center -> high demand (red): demand > supply
--   Franklin Avenue Station      -> unmet demand (purple): demand, zero supply
-- Plus a couple of extra supply-only drops elsewhere for grid-view variety.

insert into drops (anchor_id, location, categories, details, status, provider_handle, provider_token_hash, expires_at)
values
  ((select id from civic_anchors where name = 'Minneapolis Central Library'),
   ST_SetSRID(ST_MakePoint(-93.2725, 44.9774), 4326)::geography,
   ARRAY['produce'], 'Fresh produce from the community garden.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),
  ((select id from civic_anchors where name = 'Minneapolis Central Library'),
   ST_SetSRID(ST_MakePoint(-93.2721, 44.9771), 4326)::geography,
   ARRAY['coats'], 'Warm coats, various sizes.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),
  ((select id from civic_anchors where name = 'Minneapolis Central Library'),
   ST_SetSRID(ST_MakePoint(-93.2724, 44.9769), 4326)::geography,
   ARRAY['water'], 'Water cases, help yourself.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),
  ((select id from civic_anchors where name = 'Minneapolis Central Library'),
   ST_SetSRID(ST_MakePoint(-93.2722, 44.9775), 4326)::geography,
   ARRAY['general'], 'Assorted household basics.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),

  ((select id from civic_anchors where name = 'East Lake Library'),
   ST_SetSRID(ST_MakePoint(-93.2479, 44.9483), 4326)::geography,
   ARRAY['baby'], 'Diapers and baby formula.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),
  ((select id from civic_anchors where name = 'East Lake Library'),
   ST_SetSRID(ST_MakePoint(-93.2477, 44.9485), 4326)::geography,
   ARRAY['medical'], 'First aid supplies.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),

  ((select id from civic_anchors where name = 'Brian Coyle Community Center'),
   ST_SetSRID(ST_MakePoint(-93.2478, 44.9687), 4326)::geography,
   ARRAY['general'], 'Assorted household basics.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),

  ((select id from civic_anchors where name = 'Government Plaza'),
   ST_SetSRID(ST_MakePoint(-93.2655, 44.9773), 4326)::geography,
   ARRAY['produce'], 'Extra squash from the garden.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours'),
  ((select id from civic_anchors where name = 'Government Plaza'),
   ST_SetSRID(ST_MakePoint(-93.2653, 44.9771), 4326)::geography,
   ARRAY['water'], 'Bottled water, half a pallet.', 'AVAILABLE',
   'seed-density-test', encode(gen_random_bytes(32), 'hex'), now() + interval '3 hours');

insert into activity_ledger (actor_handle, event_type, drop_id, anchor_name, categories, occurred_at)
values
  -- East Lake Library: balanced (2 supply / 2 demand)
  ('seed-density-test-claimer-1', 'CLAIMED', gen_random_uuid(), 'East Lake Library', ARRAY['baby'], now() - interval '20 minutes'),
  ('seed-density-test-claimer-2', 'CLAIMED', gen_random_uuid(), 'East Lake Library', ARRAY['medical'], now() - interval '45 minutes'),

  -- Brian Coyle Community Center: high demand (1 supply / 5 demand)
  ('seed-density-test-claimer-3', 'CLAIMED', gen_random_uuid(), 'Brian Coyle Community Center', ARRAY['general'], now() - interval '5 minutes'),
  ('seed-density-test-claimer-4', 'CLAIMED', gen_random_uuid(), 'Brian Coyle Community Center', ARRAY['general'], now() - interval '15 minutes'),
  ('seed-density-test-claimer-5', 'CLAIMED', gen_random_uuid(), 'Brian Coyle Community Center', ARRAY['produce'], now() - interval '40 minutes'),
  ('seed-density-test-claimer-6', 'CLAIMED', gen_random_uuid(), 'Brian Coyle Community Center', ARRAY['water'], now() - interval '1 hour'),
  ('seed-density-test-claimer-7', 'CLAIMED', gen_random_uuid(), 'Brian Coyle Community Center', ARRAY['coats'], now() - interval '2 hours'),

  -- Franklin Avenue Station: unmet demand (0 supply / 3 demand -> hot/purple)
  ('seed-density-test-claimer-8', 'CLAIMED', gen_random_uuid(), 'Franklin Avenue Station', ARRAY['water'], now() - interval '10 minutes'),
  ('seed-density-test-claimer-9', 'CLAIMED', gen_random_uuid(), 'Franklin Avenue Station', ARRAY['produce'], now() - interval '25 minutes'),
  ('seed-density-test-claimer-10', 'CLAIMED', gen_random_uuid(), 'Franklin Avenue Station', ARRAY['general'], now() - interval '50 minutes');

-- To remove this test data later, run:
-- delete from activity_ledger where actor_handle like 'seed-density-test%';
-- delete from drops where provider_handle = 'seed-density-test';
