-- B2: TTL for time-sensitive rejections. Coverage/topic-cap rejections may
-- re-enter the pipeline after 24h if the story grows; content-based
-- rejections (junk, embed-blocked, QC hold) have no expiry (null = permanent).
alter table rejected_slugs
  add column if not exists expires_at timestamptz;

create index if not exists rejected_slugs_expires_at_idx
  on rejected_slugs (expires_at)
  where expires_at is not null;
