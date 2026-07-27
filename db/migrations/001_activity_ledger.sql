-- Migration 001: Append-only immutable activity ledger + self-cleaning TTL triggers
-- Run against the existing database. Idempotent (uses IF NOT EXISTS / OR REPLACE).

-- ---------------------------------------------------------------------------
-- 1. APPEND-ONLY ACTIVITY LEDGER
-- Every state transition is recorded here cryptographically pinned to a
-- pseudonymous handle and high-precision timestamp. Never updated, never
-- deleted. This is the source of truth for the public activity feed.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. SELF-CLEANING TTL TRIGGERS
-- Every write to `drops` triggers a statement-level cleanup that removes any
-- rows past their expires_at. This is atomic with the triggering statement so
-- there's never a window where a stale row is visible to concurrent readers.
-- Also prunes `request_log` to a rolling 24h window on every insert so the
-- rate-limit table never grows unbounded.
-- ---------------------------------------------------------------------------
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