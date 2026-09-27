# My Local — Source Registry

_The §0 / §14 deliverable. One row per source: endpoint, method, interval, credential,
what it produces, status, and licensing. Endpoints for the "wrap" sources are the ones
already in use in `lib/local/adapters/` (verified live this build). New sources are marked
**to verify**. Seed these as `local_source` rows (§3.1)._

Statuses: **active** (built + ingesting) · **to build** (Phase-1 new) · **inactive**
(built but no usable endpoint/key — `active=false` + `status_note`) · **dropped**.

---

## Phase 1 §11 sources

| slug | endpoint | method | interval | key | produces (§6) | status | licensing |
|---|---|---|---|---|---|---|---|
| `nws-alerts-marin` | `api.weather.gov/alerts/active?point={lat},{lng}` (+ `/points/{lat},{lng}` → forecast) | api | 5 min | none | `weather_alert`, `coastal_flood`; forecast → env | **active** (wrap) | Public domain (US gov). UA + contact required. |
| `caltrans-d4-lcs` | `cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json` | api (JSON) | 10 min | none | `road_closure` | **active** (wrap) | Public agency data. |
| `511-traffic-events` | `api.511.org/traffic/events?api_key=…&format=json` | api | 5 min | `BAY511_API_KEY` | `road_closure`, `road_incident` | **active** (wrap) | 511 open-data terms; attribution "511 SF Bay". |
| `noaa-tides` | `api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9415020&product=predictions&interval=hilo…` | api | 6 h | none | tide observations | **active** (wrap) | Public domain (NOAA). §11 wants nearest-per-town + bayside stations (verify IDs via CO-OPS metadata API). |
| `airnow-marin` | `www.airnowapi.org/aq/observation/latLong/current/?latitude=…&longitude=…&API_KEY=…`; fallback `api.purpleair.com/v1/sensors` | api | 30 min | `AIRNOW_API_KEY`; `PURPLEAIR_API_KEY` | AQI observations, `air_quality` | **active** (wrap) | AirNow: attribution required, no redistribution of raw as a feed. PurpleAir: API key terms. |
| `usgs-marin-gauges` | `waterservices.usgs.gov/nwis/iv/?format=json&sites={ids}&parameterCd=00060,00065` (Lagunitas, Corte Madera, Novato Creeks; discover IDs in the Marin bbox) | api | 15 min | none | gauge observations, `stream_high_water` | **to build / verify** | Public domain (USGS). ⚠️ Distinct from the existing quake feed. |
| `marin-water-storage` | Marin Water (MMWD) published reservoir storage page | html | daily 09:00 + 17:00 PT | none | reservoir observations, `reservoir_change` | **to build / verify** | Agency page; respect robots.txt. Confirm a scrapeable storage table exists. |
| `511-transit-alerts` | `api.511.org/transit/…` (service alerts / GTFS-RT) for SMART, Golden Gate Transit, Marin Transit | api / gtfs_rt | 5 min | `BAY511_API_KEY` | `transit_disruption` | **to build / verify** | 511 open-data terms. |
| `pge-outages` | PG&E public outage-map backend (JSON/ArcGIS) | api/arcgis | 5 min | none | outage observations, `power_outage` | **inactive (expected)** | Backend is WAF-protected; likely no clean public endpoint → seed `active=false`, `status_note` "no public endpoint (WAF)". |
| ~~`chp-cad-golden-gate`~~ | ~~CHP public incident page~~ | ~~html~~ | — | — | ~~`road_incident`~~ | **dropped (D7)** | `active=false`, note "redundant with 511; brittle __VIEWSTATE scrape". Do not build. |

---

## Already-active sources feeding the current live sections (wrap under §5.1)

These aren't all in the §11 table but are live today and become adapters/observation
sources during migration (D1/D7).

| slug | endpoint | key | feeds | licensing |
|---|---|---|---|---|
| `usgs-quakes` | `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` | none | Need To Know / env (D10 rule) | Public domain (USGS). |
| `nasa-firms` | `firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_SNPP_NRT/{bbox}/1` | `NASA_FIRMS_MAP_KEY` | env: thermal anomalies → NTK | NASA open; attribution. |
| `calfire-incidents` | `incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false` | none | `fire_incident` (D3) | Public agency data. |
| `caltrans-d4-cctv` | `cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json` | none | Roads cameras (reserved `camera`) | Public agency data. |
| `marin-permits` | `data.marincounty.gov/resource/mkbn-caye.json` (human grid: `…/Building-Permits-Report/nits-hbvx/explore`) | none | Changing Around You (Ph3 rebuild) | Socrata open data; unincorporated Marin only. |
| `marin-bos-agendas` | `marin.granicus.com/ViewPublisherRSS.php` → `AgendaViewer.php` (LLM extraction) | `ANTHROPIC_API_KEY` (extraction) | Your Government (Ph3 rebuild) | Public agency; store summaries. |
| `point-reyes-light` | `ptreyeslight.com/feed/` | none | Local Reporting (Ph2 ingestion) | **Journalism — summary/link/title/published_at only, never full text (§5.5).** |
| `pacific-sun` | `pacificsun.com/feed/` | none | Local Reporting | Journalism — as above. |
| `kqed` | `ww2.kqed.org/news/feed/` | none | Local Reporting | Journalism — as above. |
| `marin-ij` (coverage) | `news.google.com/rss/search?q=site:marinij.com` | none | Blindspot coverage check | Journalism — link/title only. |

---

## Journalism outlets to add (§4.4 — Phase 2 ingestion)

Local News Matters (Bay City News Foundation, tier 1) · Bay City News wire (tier 5, mark
downstream copies `derived_from`) · The Ark (tier 6) · SF Chronicle (tier 6) · ABC7 /
NBC Bay Area / CBS Bay Area / KRON4 (tier 6) · Patch Marin (tier 6, **evidence override
→ 3**) · CalMatters (tier 1). Before adding any other Marin weekly, confirm it still
publishes and record the check here.

---

## Notes
- All HTTP requests use a descriptive User-Agent with a contact email (§5.5).
- Journalism sources: store title, URL, `published_at` and our own summary only — never
  full article text for display.
- The existing national-side manifest lives at `docs/local-sources.md`; this file is the
  event-pipeline registry and supersedes it for `/local` sources.
