-- My Local — Phase 0 spine: ingestion pipeline tables.
--
-- Adds the store the §5.2 pipeline writes into: source_item (§3.2), entity (§3.4),
-- observation (§3.5), event_source (§3.7), event_update (§3.8), job_run (§3.10).
-- Event rows live in the existing `local_events` (uuid PK); event_source/update
-- FK to it. The gazetteer `place` and the spec columns on `event` (verification,
-- importance, dedupe_key, publish_state, …) are follow-ups. Conventions match the
-- prior local migrations: text+CHECK, gen_random_uuid(), RLS deny-by-default,
-- idempotent. Apply via the Supabase SQL editor.

create or replace function local_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── local_source_item (§3.2) — one normalized record per thing fetched ───────
create table if not exists local_source_item (
  id                   uuid primary key default gen_random_uuid(),
  source_id            uuid not null references local_source(id) on delete cascade,
  external_id          text,
  content_hash         text not null,
  fetched_at           timestamptz not null default now(),
  published_at         timestamptz,
  title                text,
  body_text            text,
  url                  text,
  raw_ref              text,                         -- pointer to the raw archive (§5.3)
  place_text           text,
  geom                 geometry(Geometry, 4326),
  geo_precision        text check (geo_precision in
                         ('exact','address','block','segment','place','city','county','unknown')),
  derived_from_item_id uuid references local_source_item(id) on delete set null,
  extracted            jsonb not null default '{}'::jsonb,
  processing_state     text not null default 'new'
                         check (processing_state in ('new','processed','ignored','error')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source_id, content_hash)
);
create index if not exists local_source_item_source_idx on local_source_item (source_id, fetched_at desc);
create index if not exists local_source_item_state_idx  on local_source_item (processing_state);
create index if not exists local_source_item_geom_gix   on local_source_item using gist (geom);
create or replace trigger local_source_item_touch before update on local_source_item
  for each row execute function local_touch_updated_at();

-- ── local_entity (§3.4) — a persistent thing with state ──────────────────────
create table if not exists local_entity (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null check (entity_type in
                     ('reservoir','reservoir_system','stream_gauge','tide_station','aq_monitor',
                      'road_segment','transit_line','outage_area','project','camera','meeting_body','school')),
  name             text not null,
  place_id         uuid,                             -- FK to gazetteer place (added later)
  geom             geometry(Geometry, 4326),
  source_id        uuid references local_source(id) on delete set null,
  attributes       jsonb not null default '{}'::jsonb,
  current_state    jsonb not null default '{}'::jsonb,
  current_state_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists local_entity_type_idx on local_entity (entity_type);
create index if not exists local_entity_geom_gix on local_entity using gist (geom);
create or replace trigger local_entity_touch before update on local_entity
  for each row execute function local_touch_updated_at();

-- ── local_observation (§3.5) — append-only time series. NEVER delete. ────────
create table if not exists local_observation (
  id             bigserial primary key,
  entity_id      uuid not null references local_entity(id) on delete cascade,
  source_item_id uuid references local_source_item(id) on delete set null,
  observed_at    timestamptz not null,
  metric         text not null,                       -- storage_pct, customers_out, aqi, water_level_ft, …
  value_num      numeric,
  value_text     text,
  unit           text,
  created_at     timestamptz not null default now()
);
create index if not exists local_observation_series_idx on local_observation (entity_id, metric, observed_at desc);

-- ── local_event_source (§3.7) — links items to events ────────────────────────
create table if not exists local_event_source (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references local_events(id) on delete cascade,
  source_item_id uuid not null references local_source_item(id) on delete cascade,
  role           text not null check (role in ('origin','corroboration','update','resolution')),
  is_independent boolean not null default true,       -- computed per §4.2
  attached_at    timestamptz not null default now(),
  unique (event_id, source_item_id)
);
create index if not exists local_event_source_event_idx on local_event_source (event_id);

-- ── local_event_update (§3.8) — timeline + corrections log ───────────────────
create table if not exists local_event_update (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references local_events(id) on delete cascade,
  at             timestamptz not null default now(),
  kind           text not null check (kind in ('detected','status_change','detail','correction','resolved')),
  text           text,
  source_item_id uuid references local_source_item(id) on delete set null,
  prev_value     jsonb,
  new_value      jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists local_event_update_event_idx on local_event_update (event_id, at desc);

-- ── local_job_run (§3.10) — one row per source poll (D4 logs here) ───────────
create table if not exists local_job_run (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references local_source(id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text,                                -- ok | error | skipped | timeout
  items_fetched  int not null default 0,
  items_new      int not null default 0,
  events_created int not null default 0,
  events_updated int not null default 0,
  error          text,
  created_at     timestamptz not null default now()
);
create index if not exists local_job_run_source_idx on local_job_run (source_id, started_at desc);

-- RLS deny-by-default (service role bypasses); no public policies.
alter table local_source_item  enable row level security;
alter table local_entity       enable row level security;
alter table local_observation  enable row level security;
alter table local_event_source enable row level security;
alter table local_event_update enable row level security;
alter table local_job_run      enable row level security;
