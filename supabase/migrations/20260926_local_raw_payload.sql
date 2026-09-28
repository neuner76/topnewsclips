-- My Local — Phase 0: raw-payload archive (§5.3).
--
-- Every raw fetch is archived (append-only) so we can replay/debug normalization.
-- Keyed source_slug/YYYY/MM/DD/<fetched_at>-<hash>; source_item.raw_ref points here.
-- Retention: 90 days (a cleanup job deletes older rows — follow-up); normalized
-- source_items are kept indefinitely. Body stored as text (Postgres TOAST
-- compresses it); an object-store backend can replace this table later (O3).
-- Conventions match the prior local migrations. Apply via the Supabase SQL editor.

create table if not exists local_raw_payload (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references local_source(id) on delete cascade,
  source_slug  text not null,
  storage_key  text not null unique,                 -- = raw_ref on local_source_item
  content_hash text not null,
  content_type text,
  url          text,
  fetched_at   timestamptz not null,
  body         text,
  byte_size    int,
  created_at   timestamptz not null default now()
);
create index if not exists local_raw_payload_source_idx  on local_raw_payload (source_id, fetched_at desc);
create index if not exists local_raw_payload_created_idx on local_raw_payload (created_at);  -- for 90-day cleanup

alter table local_raw_payload enable row level security;
