-- A3: persist the underlying video's upload/publish date on candidates so the
-- freshness gate (Phase 1) and QC's C4 freshness check (Phase 2, via
-- video_publish_date) can both use it.
alter table candidates
  add column if not exists uploaded_at timestamptz;
