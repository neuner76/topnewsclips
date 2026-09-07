-- TopNewsClips Local — Build A schema.
--
-- PostGIS-backed geography for saved places and local events, plus the geocode
-- cache and LLM-spend ledger. Apply once (Supabase SQL editor or `supabase db
-- push`). CREATE EXTENSION is idempotent — safe even though PostGIS was already
-- enabled via the dashboard.
--
-- Privacy: exact coordinates live only in env vars and rows flagged is_private.
-- These tables are written/read server-side (service role) only; /local is
-- owner-auth-gated. RLS is enabled with no public policies (deny-by-default;
-- the service role bypasses RLS) so nothing is ever exposed to anon/authenticated
-- clients directly.

create extension if not exists postgis;

-- Saved places: a polygon boundary OR a point + radius (never a bare label).
create table if not exists local_saved_places (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  type         text not null check (type in ('home','work','school','property','route','custom')),
  center       geometry(Point, 4326),            -- for point+radius places
  radius_miles double precision,
  boundary     geometry(MultiPolygon, 4326),     -- for polygon places
  zip_code     text,
  city         text,
  county       text,
  state        text,
  is_private   boolean not null default false,
  created_at   timestamptz not null default now(),
  -- must have at least one spatial definition
  constraint local_saved_places_has_geometry check (center is not null or boundary is not null)
);
create index if not exists local_saved_places_center_gix   on local_saved_places using gist (center);
create index if not exists local_saved_places_boundary_gix on local_saved_places using gist (boundary);

-- Canonical local event. event_geom is a point or polygon for spatial queries;
-- the full GeoScope (cities/counties/zips/regions) is kept in geo jsonb.
create table if not exists local_events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  event_type        text not null,
  status            text not null check (status in ('new','developing','ongoing','resolved')),
  story_cluster_id  text,                          -- bridge to a national Story cluster, nullable
  first_seen_at     timestamptz not null,
  latest_update_at  timestamptz not null,
  event_geom        geometry(Geometry, 4326),      -- point or polygon
  geo               jsonb not null default '{}'::jsonb,
  consequence_score double precision not null default 0,
  relevance_score   double precision,
  confidence        text not null check (confidence in ('high','medium','low')),
  sources           jsonb not null default '[]'::jsonb,
  summary           text,
  why_it_matters    text,
  what_changed      text,
  open_questions    jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists local_events_geom_gix   on local_events using gist (event_geom);
create index if not exists local_events_status_idx on local_events (status);
create index if not exists local_events_type_idx   on local_events (event_type);
create index if not exists local_events_seen_idx   on local_events (first_seen_at desc);

-- Geocode cache: never geocode the same normalized string twice.
create table if not exists local_geocode_cache (
  normalized_address text primary key,
  latitude           double precision not null,
  longitude          double precision not null,
  provider           text not null,               -- 'census' | 'nominatim'
  raw                jsonb,
  created_at         timestamptz not null default now()
);

-- LLM-spend ledger for agenda extraction (Build B); enforces per-run/day ceilings.
create table if not exists local_llm_spend (
  id            uuid primary key default gen_random_uuid(),
  run_id        text,
  document_url  text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,4) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists local_llm_spend_created_idx on local_llm_spend (created_at desc);

-- Deny-by-default RLS. Server code uses the service role (bypasses RLS); no anon
-- or authenticated policies are granted, so these tables are never client-readable.
alter table local_saved_places enable row level security;
alter table local_events       enable row level security;
alter table local_geocode_cache enable row level security;
alter table local_llm_spend    enable row level security;
