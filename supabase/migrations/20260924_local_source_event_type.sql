-- My Local — Phase 0 spine: source registry + event-type catalog.
--
-- Adds `local_source` (§3.1) and `local_event_type` (§3.9, config), seeded from
-- §6 (event types) and §11 / docs/local/SOURCES.md (sources, with D7 statuses).
-- Conventions match 20260907_local_schema.sql: text + CHECK (no PG enums),
-- gen_random_uuid(), RLS deny-by-default (service role bypasses). Idempotent —
-- apply via the Supabase SQL editor / `supabase db push`.
--
-- `evidence_level` is stored but derived from source_type/tier (§4.1); the code
-- function deriveEvidenceLevel(source) is the source of truth and must agree.

create or replace function local_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── local_source (§3.1) ──────────────────────────────────────────────────────
create table if not exists local_source (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name                   text not null,
  url                    text,
  endpoint               text,
  source_type            text not null check (source_type in
                           ('official_agency','utility','public_dataset','sensor',
                            'journalism','community_org','social_account','user_submission')),
  credibility_tier       int,                       -- national source_tier; null for official (§4.1/D8)
  evidence_level         int check (evidence_level between 1 and 5),  -- derived (§4.1)
  evidence_level_override int check (evidence_level_override between 1 and 5), -- §4.3
  parent_org             text,                      -- §4.2 independence (optional)
  geography              text[] not null default '{}',
  topics                 text[] not null default '{}',
  ingestion_method       text check (ingestion_method in
                           ('api','rss','html','pdf','arcgis','gtfs_rt','email','manual')),
  crawl_interval_seconds int,                       -- D4: min 300 (5 min)
  licensing_notes        text,
  active                 boolean not null default false,
  status_note            text,
  last_success_at        timestamptz,
  last_error_at          timestamptz,
  last_error             text,
  consecutive_failures   int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists local_source_active_idx on local_source (active);
create or replace trigger local_source_touch before update on local_source
  for each row execute function local_touch_updated_at();

-- ── local_event_type (§3.9, config seeded from §6) ───────────────────────────
create table if not exists local_event_type (
  slug                          text primary key,
  label                         text not null,
  layer                         text not null,
  icon                          text,
  required_fields               text[] not null default '{}',  -- extras beyond the global set (§6); enforced in code
  cluster_time_window_minutes   int,
  cluster_distance_m            int,
  min_geo_precision             text check (min_geo_precision in
                                  ('exact','address','block','segment','place','city','county','unknown')),
  auto_publish                  boolean not null default false,
  auto_publish_min_evidence_level int,
  base_importance               int not null default 0,
  auto_resolve_after_minutes    int,
  archive_after_days            int not null default 30,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
create or replace trigger local_event_type_touch before update on local_event_type
  for each row execute function local_touch_updated_at();

-- RLS deny-by-default (service role bypasses); no public policies.
alter table local_source     enable row level security;
alter table local_event_type enable row level security;

-- ── Seed: event types (§6) ───────────────────────────────────────────────────
-- Phase-1 types auto-publish; reserved types get auto_publish=false so later
-- phases slot in. min_geo 'route' (transit) mapped to 'segment' (nearest valid).
-- fire_incident auto_publish=true per D3 (CAL FIRE-listed incidents, evidence 1).
insert into local_event_type
  (slug, label, layer, icon, cluster_time_window_minutes, cluster_distance_m, min_geo_precision,
   auto_publish, auto_publish_min_evidence_level, base_importance, auto_resolve_after_minutes, archive_after_days)
values
  ('power_outage',       'Power outage',                 'Power',       '⚡', 180,   3000, 'city',    true,  1,  30, null, 30),
  ('road_closure',       'Road closure',                 'Roads',       '🚧', 360,   1000, 'segment', true,  1,  45, null, 30),
  ('road_incident',      'Road incident',                'Roads',       '🚧', 120,   800,  'segment', true,  1,  35, 240,  30),
  ('weather_alert',      'Weather alert',                'Weather',     '🌧', null,  null, 'county',  true,  1,  40, null, 30),
  ('air_quality',        'Air quality alert',            'Environment', '🌲', 720,   null, 'county',  true,  1,  40, null, 30),
  ('reservoir_change',   'Reservoir change',             'Water',       '🌊', null,  null, 'exact',   true,  1,  20, null, 30),
  ('stream_high_water',  'High water',                   'Water',       '🌊', 720,   null, 'exact',   true,  1,  55, null, 30),
  ('coastal_flood',      'Coastal flooding / king tide', 'Water',       '🌊', 720,   5000, 'place',   true,  1,  45, null, 30),
  ('transit_disruption', 'Transit disruption',           'Transit',     '🚆', 180,   null, 'segment', true,  1,  30, null, 30),
  ('fire_incident',      'Fire',                         'Fire',        '🔥', 360,   2000, 'place',   true,  1,  60, null, 30),
  ('public_safety',      'Public safety',                'Safety',      '🚨', 180,   800,  'place',   false, null, 0,  null, 30),
  ('government_action',  'Government',                   'Government',  '🏛', 20160, null, 'city',    false, null, 0,  null, 30),
  ('development_update', 'Development',                  'Development', '🏗', null,  null, 'address', false, null, 0,  null, 30),
  ('community_report',   'Community report',            'Community',   '📱', 120,   500,  'place',   false, null, 0,  null, 30)
on conflict (slug) do update set
  label = excluded.label, layer = excluded.layer, icon = excluded.icon,
  cluster_time_window_minutes = excluded.cluster_time_window_minutes,
  cluster_distance_m = excluded.cluster_distance_m, min_geo_precision = excluded.min_geo_precision,
  auto_publish = excluded.auto_publish, auto_publish_min_evidence_level = excluded.auto_publish_min_evidence_level,
  base_importance = excluded.base_importance, auto_resolve_after_minutes = excluded.auto_resolve_after_minutes,
  archive_after_days = excluded.archive_after_days;

-- ── Seed: source registry (§11 + existing live sources; statuses per D7) ──────
-- active=true = has a working adapter today. active=false = to-build / dropped /
-- journalism (store ingestion is Phase 2, §15). evidence_level per §4.1.
insert into local_source
  (slug, name, url, endpoint, source_type, credibility_tier, evidence_level, geography, topics,
   ingestion_method, crawl_interval_seconds, licensing_notes, active, status_note)
values
  -- Official feeds with working adapters (wrap into §5.1)
  ('nws-alerts-marin','National Weather Service alerts','https://www.weather.gov','https://api.weather.gov/alerts/active','official_agency',null,1,'{marin}','{weather}','api',300,'Public domain (US gov); UA+contact required',true,null),
  ('caltrans-d4-lcs','Caltrans D4 lane closures','https://quickmap.dot.ca.gov','https://cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json','official_agency',null,1,'{marin}','{roads}','api',600,'Public agency data',true,null),
  ('caltrans-d4-cctv','Caltrans D4 cameras','https://quickmap.dot.ca.gov','https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json','official_agency',null,1,'{marin}','{roads,cameras}','api',300,'Public agency data',true,null),
  ('511-traffic-events','511 SF Bay traffic events','https://511.org','https://api.511.org/traffic/events','official_agency',null,1,'{marin}','{roads}','api',300,'511 open-data terms; attribution "511 SF Bay" (BAY511_API_KEY)',true,null),
  ('noaa-tides','NOAA CO-OPS tides','https://tidesandcurrents.noaa.gov','https://api.tidesandcurrents.noaa.gov/api/prod/datagetter','official_agency',null,1,'{marin}','{water}','api',21600,'Public domain (NOAA)',true,null),
  ('airnow-marin','AirNow / PurpleAir air quality','https://www.airnow.gov','https://www.airnowapi.org/aq/observation/latLong/current/','public_dataset',null,1,'{marin}','{air}','api',1800,'AirNow attribution; PurpleAir key terms (AIRNOW_API_KEY, PURPLEAIR_API_KEY)',true,null),
  ('usgs-quakes','USGS earthquakes','https://earthquake.usgs.gov','https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson','official_agency',null,1,'{marin}','{earthquake}','api',900,'Public domain (USGS)',true,null),
  ('nasa-firms','NASA FIRMS active fire','https://firms.modaps.eosdis.nasa.gov','https://firms.modaps.eosdis.nasa.gov/api/area/csv','sensor',null,1,'{marin}','{fire}','api',1800,'NASA open; attribution (NASA_FIRMS_MAP_KEY)',true,null),
  ('calfire-incidents','CAL FIRE incidents','https://incidents.fire.ca.gov','https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List','official_agency',null,1,'{marin}','{fire}','api',900,'Public agency data',true,null),
  ('marin-permits','Marin County building permits','https://data.marincounty.gov/County-Government/Building-Permits-Report/nits-hbvx','https://data.marincounty.gov/resource/mkbn-caye.json','public_dataset',null,1,'{marin}','{development}','api',86400,'Socrata open data; unincorporated Marin only',true,null),
  ('marin-bos-agendas','Marin County BoS agendas','https://marin.granicus.com','https://marin.granicus.com/ViewPublisherRSS.php','official_agency',null,1,'{marin}','{government}','rss',86400,'Public agency; store summaries only',true,null),
  -- To build (Phase 1)
  ('usgs-marin-gauges','USGS Marin stream gauges','https://waterservices.usgs.gov','https://waterservices.usgs.gov/nwis/iv/','public_dataset',null,1,'{marin}','{water}','api',900,'Public domain (USGS)',false,'adapter not built (Phase 1); distinct from the quake feed'),
  ('marin-water-storage','Marin Water reservoir storage','https://www.marinwater.org',null,'utility',null,1,'{marin}','{water}','html',43200,'Agency page; respect robots.txt',false,'adapter not built (Phase 1); verify a scrapeable storage table'),
  ('511-transit-alerts','511 SF Bay transit alerts','https://511.org','https://api.511.org/transit','official_agency',null,1,'{marin}','{transit}','gtfs_rt',300,'511 open-data terms (BAY511_API_KEY)',false,'adapter not built (Phase 1)'),
  ('pge-outages','PG&E outages','https://pgealerts.alerts.pge.com/outagecenter',null,'utility',null,1,'{marin}','{power}','arcgis',300,'PG&E public outage data',false,'no public endpoint (WAF-protected)'),
  ('chp-cad-golden-gate','CHP CAD (Golden Gate)','https://cad.chp.ca.gov',null,'official_agency',null,1,'{marin}','{roads}','html',300,'Public agency data',false,'dropped (D7): redundant with 511; brittle __VIEWSTATE scrape'),
  -- Journalism (store ingestion Phase 2, §15; live in Local Reporting now)
  ('point-reyes-light','Point Reyes Light','https://www.ptreyeslight.com','https://www.ptreyeslight.com/feed/','journalism',6,2,'{west-marin}','{local-news}','rss',3600,'Journalism — summary/link/title/published_at only, never full text (§5.5)',false,'store ingestion Phase 2; live in Local Reporting now'),
  ('pacific-sun','Pacific Sun','https://pacificsun.com','https://pacificsun.com/feed/','journalism',6,2,'{marin}','{local-news}','rss',3600,'Journalism — summary/link only (§5.5)',false,'store ingestion Phase 2; live in Local Reporting now'),
  ('kqed','KQED','https://www.kqed.org/news','https://ww2.kqed.org/news/feed/','journalism',3,2,'{marin}','{local-news}','rss',3600,'Journalism — summary/link only (§5.5)',false,'store ingestion Phase 2; live in Local Reporting now')
on conflict (slug) do update set
  name = excluded.name, url = excluded.url, endpoint = excluded.endpoint,
  source_type = excluded.source_type, credibility_tier = excluded.credibility_tier,
  evidence_level = excluded.evidence_level, geography = excluded.geography, topics = excluded.topics,
  ingestion_method = excluded.ingestion_method, crawl_interval_seconds = excluded.crawl_interval_seconds,
  licensing_notes = excluded.licensing_notes, active = excluded.active, status_note = excluded.status_note;
