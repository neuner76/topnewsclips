-- My Local — Phase 1: extend local_events with the spec §3.6 event columns.
--
-- Additive only — the existing Build-A columns (title, status, confidence text,
-- consequence_score, geo, sources, …) stay; the pipeline populates these new ones.
-- Notes: `headline` is the neutral ≤90-char headline (title stays as-is);
-- `confidence_num` is the numeric §4.4 confidence (existing text `confidence`
-- high/med/low is untouched); `lifecycle_state` (active/resolved/archived) is the
-- spec lifecycle (existing `status` new/developing/ongoing/resolved stays).
-- Conventions match the prior local migrations. Apply via the Supabase SQL editor.

alter table local_events add column if not exists headline           text;
alter table local_events add column if not exists lifecycle_state    text
  check (lifecycle_state in ('active','resolved','archived')) default 'active';
alter table local_events add column if not exists verification_status text
  check (verification_status in ('confirmed','developing','community_reports','unverified')) default 'unverified';
alter table local_events add column if not exists importance         int default 0;
alter table local_events add column if not exists confidence_num     numeric;
alter table local_events add column if not exists first_detected_at  timestamptz;
alter table local_events add column if not exists resolved_at        timestamptz;
alter table local_events add column if not exists place_id           uuid;
alter table local_events add column if not exists geo_precision      text
  check (geo_precision in ('exact','address','block','segment','place','city','county','unknown'));
alter table local_events add column if not exists primary_entity_id  uuid references local_entity(id) on delete set null;
alter table local_events add column if not exists publish_state      text
  check (publish_state in ('published','held','rejected')) default 'held';
alter table local_events add column if not exists publish_reason     text;
alter table local_events add column if not exists dedupe_key         text;

-- Deterministic match key for single-source structured events (§7.3): at most one
-- ACTIVE event per key. (Partial unique so resolved/archived keys can recur.)
create unique index if not exists local_events_dedupe_active_uidx
  on local_events (dedupe_key)
  where dedupe_key is not null and lifecycle_state = 'active';

create index if not exists local_events_publish_idx   on local_events (publish_state);
create index if not exists local_events_lifecycle_idx on local_events (lifecycle_state);
