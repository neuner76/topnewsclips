-- Nightly QC sweep was processing every published story in a 14-day window
-- (1000+ LLM calls) in one request and timing out. This column lets the
-- sweep process a bounded batch per run, rotating through the backlog:
-- never-swept stories (null) go first, then least-recently-swept.
alter table stories add column if not exists qc_swept_at timestamptz null;

create index if not exists stories_qc_swept_at_idx
  on stories (qc_swept_at nulls first)
  where published = true;
