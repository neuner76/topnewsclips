-- A2: log table for the one-time QC backfill and the nightly QC reconciliation
-- sweep. Every story re-checked by either job gets a row here, regardless of
-- outcome, so we can audit what the sweep found/changed over time.
create table if not exists qc_sweep_log (
  id uuid primary key default gen_random_uuid(),
  story_slug text not null,
  source text not null, -- 'backfill' | 'nightly_sweep'
  verdict text not null, -- 'PASS' | 'FIX' | 'HOLD'
  failed_checks jsonb,
  action text not null, -- 'none' | 'auto_fix' | 'hold'
  dry_run boolean not null default false,
  routing_note text,
  created_at timestamptz not null default now()
);

create index if not exists qc_sweep_log_story_slug_idx on qc_sweep_log (story_slug);
create index if not exists qc_sweep_log_created_at_idx on qc_sweep_log (created_at);
