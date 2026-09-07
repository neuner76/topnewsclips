# TopNewsClips Local — Source Manifest

_Generated from `lib/local/sources/manifest.json` (the source of truth). Verified 2026-09-07._

**Totals:** 33 sources — 10 ready, 4 needs_key, 17 stub, 2 blocked.

Adapters may only be written for sources whose status is `ready` or `needs_key` (key present). Build A ships live environmental feeds; every other section is fixture-backed until its build phase.

## camera

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| Caltrans QuickMap / CWWP2 cameras + closures | `stub` | C | api (caltrans-cwwp2) | — | https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json |

## emergency

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| AlertMarin (emergency notifications) | `blocked` | C | none (everbridge) | — | https://www.marinsheriff.org/services/emergency-services/alert-marin |
| Marin County Sheriff — alerts / press | `stub` | C | html | — | https://www.marinsheriff.org/ |
| Nixle / local agency alerts | `stub` | C | none (nixle) | — | https://www.nixle.com/ |

## environment

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| AirNow — Air Quality (AQI) | `needs_key` | A | api (airnowapi.org) | AIRNOW_API_KEY | https://www.airnowapi.org/aq/observation/latLong/current/ |
| NASA FIRMS — Thermal Anomalies / Active Fire | `needs_key` | A | api (firms.modaps.eosdis.nasa.gov) | NASA_FIRMS_MAP_KEY | https://firms.modaps.eosdis.nasa.gov/api/area/ |
| NOAA CO-OPS Tides — Point Reyes | `ready` | A | api (tidesandcurrents.noaa.gov) | — | https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9415020&product=predictions&interval=hilo&datum=MLLW&units=english&time_zone=lst_ldt&format=json&date=today |
| National Weather Service — Active Alerts | `ready` | A | api (api.weather.gov) | — | https://api.weather.gov/alerts/active?point={lat},{lng} |
| National Weather Service — Forecast + Fire Weather Zone | `ready` | A | api (api.weather.gov) | — | https://api.weather.gov/points/{lat},{lng} |
| PurpleAir — Community Air Sensors | `needs_key` | A | api (api.purpleair.com) | PURPLEAIR_API_KEY | https://api.purpleair.com/v1/sensors |
| USGS Earthquakes — GeoJSON feed | `ready` | A | api (earthquake.usgs.gov) | — | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson |
| USGS Water Services — Stream/Flood Gauges | `stub` | A | api (waterservices.usgs.gov) | — | https://waterservices.usgs.gov/nwis/iv/?format=json&countyCd=06041&parameterCd=00065&siteStatus=active |

## government

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| Marin County Board of Supervisors | `ready` | B | api (legistar) | — | https://marin.legistar.com/Calendar.aspx |
| Marin County Fire / Novato Fire District | `stub` | B | html | — | https://www.marincounty.gov/departments/fire |
| Marin Municipal Water District | `stub` | B | html | — | https://www.marinwater.org/ |
| Marin County Planning Commission | `ready` | B | api (legistar) | — | https://marin.legistar.com/Calendar.aspx |
| Marin County Public Notices | `stub` | B | html | — | https://www.marincounty.gov/ |
| Novato City Council | `stub` | B | html (unconfirmed) | — | https://www.novato.org/government/city-council/agendas-minutes |
| Novato Design Review Commission | `stub` | B | html (unconfirmed) | — | https://www.novato.org/government/community-development |
| Novato Planning Commission | `stub` | B | html (unconfirmed) | — | https://www.novato.org/government/community-development/planning |
| Novato Unified School District Board | `stub` | B | html (unconfirmed) | — | https://www.nusd.org/ |
| SMART (Sonoma-Marin Area Rail Transit) Board | `stub` | B | html | — | https://www.sonomamarintrain.org/ |

## incident

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| CHP Traffic Incidents (CAD) | `ready` | C | html (chp-cad) | — | https://cad.chp.ca.gov/traffic.aspx |

## journalism

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| KQED | `ready` | C | rss | — | https://www.kqed.org/news |
| Marin Independent Journal | `blocked` | C | rss | — | https://www.marinij.com/ |
| Pacific Sun | `stub` | C | rss | — | https://pacificsun.com/ |
| Point Reyes Light | `ready` | C | rss | — | https://www.ptreyeslight.com/ |
| SF Chronicle — regional reporting | `stub` | C | rss | — | https://www.sfchronicle.com/ |

## planning

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| Marin County Open Data (permits, parcels, boundaries) | `ready` | B | open_data (socrata) | — | https://data.marincounty.gov/ |
| Novato Building Permits | `stub` | B | html (unconfirmed) | — | https://www.novato.org/government/community-development/building |

## transportation

| Source | Status | Phase | Access | Key | Entry |
|---|---|---|---|---|---|
| 511 SF Bay — traffic + transit | `needs_key` | C | api (511.org) | BAY511_API_KEY | https://511.org/open-data |
| Golden Gate Ferry service alerts | `stub` | C | api (gtfs-rt) | — | https://www.goldengate.org/ferry/ |
| SMART rail service alerts | `stub` | C | api (gtfs-rt) | — | https://www.sonomamarintrain.org/ |

