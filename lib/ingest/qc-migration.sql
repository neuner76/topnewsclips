-- TNC Pre-Publish QC Firewall — schema migration (v1)
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

-- Log every QC gate run so failure patterns can surface weekly.
create table if not exists qc_log (
  id uuid primary key default gen_random_uuid(),
  story_slug text not null,
  created_at timestamptz not null default now(),
  verdict text not null check (verdict in ('PASS', 'FIX', 'HOLD')),
  failed_checks jsonb not null default '[]'::jsonb,
  revision_applied boolean not null default false,
  raw_result jsonb not null default '{}'::jsonb
);

create index if not exists qc_log_story_slug_idx on qc_log (story_slug);
create index if not exists qc_log_created_at_idx on qc_log (created_at desc);

-- Track QC outcome on the story itself so the admin holds queue and feed
-- filters can query it directly.
alter table stories
  add column if not exists qc_status text check (qc_status in ('pass', 'hold')),
  add column if not exists qc_failed_checks jsonb,
  add column if not exists qc_routing_note text;

create index if not exists stories_qc_status_idx on stories (qc_status) where qc_status = 'hold';
