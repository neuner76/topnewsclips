# My Local — Existing Module Inventory

_The §0 inventory deliverable. Maps what already exists in `lib/local/`, `app/local/`,
and the DB to the Phase 0/1 build spec's tables (§3), adapters (§5/§11), sections (§16),
and UI (§12). Read this before writing Phase 0 code. Decisions referenced as D1–D12
are §0.1 of the spec._

Repo conventions (per **D5**): code in `lib/local/` + `app/local/`; tables are
`local_`-prefixed in the **public** schema (there is no `local` Postgres schema).
Env vars per **D6**: `BAY511_API_KEY`, `AIRNOW_API_KEY`, `PURPLEAIR_API_KEY`,
`NASA_FIRMS_MAP_KEY` (no `LOCAL_511_API_KEY` / `LOCAL_AIRNOW_API_KEY`).

**Current architecture:** every `/local` page computes its digest **live per request**
via `lib/local/digest.ts::buildMyLocalDigest()` (parallelized fetches, wrapped in a
10-min `unstable_cache` in `digest-cache.ts`). Nothing is stored as events/observations
yet — `local_events` exists but is unused. Phase 0/1 introduces the stored pipeline and
migrates sections into it via the strangler pattern (**D1**).

---

## 1. Adapters — existing vs §11 sources

Existing adapters are pure `fetch*`/`parse*`/`normalize*` functions returning in-memory
`LocalEvent[]` / snapshot shapes. Per **D7**, wrap them in the §5.1 `SourceAdapter`
interface — do **not** rewrite the fetch/parse logic.

| Existing module | §11 source / role | Status | Produces (§6) | Notes |
|---|---|---|---|---|
| `adapters/nws.ts` | `nws-alerts-marin` (+ forecast) | **wrap** | `weather_alert`, `coastal_flood`; forecast → env | Forecast gridpoint already resolved per-point. |
| `adapters/caltrans-lcs.ts` | `caltrans-d4-lcs` | **wrap** | `road_closure` | County-filtered Marin/Sonoma; internal dedupe done. Needs cross-source dedupe w/ 511 (§16.3). |
| `adapters/bay511.ts` | `511-traffic-events` | **wrap** | `road_closure`, `road_incident` | Uses `BAY511_API_KEY`. |
| `adapters/calfire.ts` | fire adapter (**D3**) | **wrap** | `fire_incident` | Already feeds Need To Know (40 mi radius); re-scope to town radius + region (D11). |
| `adapters/firms.ts` | NASA FIRMS thermal | **wrap** | env: thermal anomalies | Part of "Your Environment", not a named §11 event source. |
| `adapters/usgs.ts` | USGS **earthquakes** | **wrap** | env: recent quakes → NTK | ⚠️ NOT the same as §11 `usgs-marin-gauges` (stream gauges) — that's **new**. Earthquake rule per **D10** (M3.5+/50 mi). |
| `adapters/noaa-tides.ts` | `noaa-tides` | **wrap** | tide observations | One station (Point Reyes 9415020) today; §11 wants nearest-per-town + bayside stations. |
| `adapters/airnow.ts` + `adapters/purpleair.ts` | `airnow-marin` | **wrap** | AQI observations, `air_quality` | AirNow → PurpleAir fallback already implemented. |
| `adapters/caltrans-cameras.ts` | Roads cameras | **keep** | (reserved `camera` entity) | Live thumbnails; §16.3 wants HLS player + radius filter (radius done). |
| `adapters/local-news.ts` | journalism (PRL/Pacific Sun/KQED) | **keep (live)** | Local Reporting section | Journalism **ingestion** is Phase 2 (§15). Live section stays; §16.3 wants per-town filter + all tracked outlets. |
| `adapters/marin-permits.ts` | county permits | **keep (live)** | Changing Around You | Permits **rebuild** is Phase 3 (§15). §16.3 fixes apply now (acronyms, sort, city feeds, valuation guard ✓). |
| `adapters/marin-granicus.ts` + `adapters/marin-agenda-detail.ts` + `agenda-extract.ts` | BoS agendas (LLM) | **keep (live)** | Your Government | `government_action` rebuild is Phase 3 (§15). LLM skipped in shared mode. |
| `adapters/types.ts` | shared shapes | reference | — | `LocalEvent`, `EnvironmentSnapshot`, `EnvironmentSources`, reading types. |

**New adapters to build (Phase 1, D7):**
`marin-water-storage` (html, reservoir → `reservoir_change`), `usgs-marin-gauges`
(USGS Water Services IV → `stream_high_water`), `511-transit-alerts`
(SMART/GGT/Marin Transit → `transit_disruption`), `pge-outages` (expect `active=false`
— WAF-protected; record why).

**Dropped (D7):** `chp-cad-golden-gate` — seed `active=false`, note "redundant with 511; brittle scrape". **Do not build.**

---

## 2. Logic modules — existing vs spec sections

| Existing module | Maps to | Reuse / gap |
|---|---|---|
| `need-to-know.ts` (`buildNeedToKnow`) | NTK synthesis → **events** | **Phase-1 migration target #1.** Currently synthesizes NTK from alerts/quakes/FIRMS/fire/closures in memory; becomes `event` producer. |
| `digest.ts` (`buildMyLocalDigest`) | live section builder | Split into per-section resolvers so **D1's per-section store-vs-live flag** can toggle each (new `lib/local/config`). |
| `digest-cache.ts` | 10-min cache | Keep for still-live sections. |
| `anchors.ts` + `geography.ts` | §8 geolocation / proximity | Haversine + multi-place radius filtering exist. **D11 adds region grouping** (4 region polygons — see gaps). |
| `scoring.ts` + `scoring.config.ts` | §9 importance + §4.4 confidence | Has `proximityScore`, `confidenceToNumber`, consequence weights. **Needs:** countywide `importance` formula (§9), `deriveEvidenceLevel` (§4.1), verification rules (§4.3), confidence formula (§4.4). |
| `blindspot.ts` + `coverage.ts` | Local Blindspot | Live now; **rebuild Phase 3** (§15). §16.3 = geo-filter per town + 7-day rotation on the live page. |
| `dedup.ts` (`mergeLocalEvents`) | §7.3 matching | Basis for `findMatchingEvent`; add cross-source (511↔Caltrans) match. |
| `lifecycle.ts` (`deriveEventStatus`) | §7.4 resolution | Extend to feed-absent / auto-resolve / archive. |
| `format.ts` | display (freshness) | Keep; PT display (§2). |
| `privacy.ts` | §10 privacy | Has coordinate/place privacy; **add name-stripping** (light heuristic — Phase-1 sources are official). |
| `marin-places.ts` + `seed-places.ts` + `share.ts` | §16 towns + gazetteer + share tokens | 20 towns today; **§16.1 needs the full list**. `share.ts` token/slug/zip resolution reusable. |
| `analytics.ts` | tracking | Keep. |
| `fixtures.ts` + `*.test.ts` | §13 testing | Fixture pattern already established (adapter tests vs committed fixtures). Extend per §13. |

---

## 3. Database — existing tables vs §3 model

Existing (migration `supabase/migrations/20260907_local_schema.sql`, PostGIS enabled):

| Existing table | Maps to | Action |
|---|---|---|
| `local_saved_places` | owner's places / §16 `place` rows (partial) | **reuse**; the gazetteer `place` (§3.3) is broader — extend or add alongside. |
| `local_events` | `event` (§3.6) | **reuse/extend** — currently unused; the pipeline will populate it. Add spec columns (verification, importance, dedupe_key, publish_state, …). |
| `local_geocode_cache` | §8 / **D12** geocode cache | **reuse**; add miss-caching with 30-day retry. |
| `local_llm_spend` | LLM cost log | keep. |

**New tables to create (§3):** `local_source`, `local_source_item`, `local_place`
(gazetteer, if not folding into an extended `local_saved_places`), `local_entity`,
`local_observation`, `local_event_source`, `local_event_update`, `local_event_type`
(config, seeded from §6), `local_job_run` (D4 logs to `local_job_runs`), and raw archive
(§5.3 — prefer Supabase Storage over a `bytea` table given volume).

> Note: **D5** says reuse `local_events` etc.; apply the `local_` prefix to every new
> table above and keep them in `public`, not a `local` schema.

---

## 4. Routes / UI — existing vs §12/§16 (D1)

| Existing route | Role | Spec disposition |
|---|---|---|
| `app/local/page.tsx` | owner proximity briefing (auth-gated) | **STAYS** — per **D1**, `/local` is NOT replaced. §12.1's countywide feed ships at `/local/live`. |
| `app/local/LocalDigestView.tsx` | shared render (owner + share) | Keep; event cards will link to `/local/events/[id]`. |
| `app/local/share/page.tsx` | town index (20 towns) | §16.2 — add full §16.1 town list + `/local/share/{slug}.json`. |
| `app/local/share/[token]/page.tsx` | town briefings (token/slug/ZIP) | Keep; apply §16.3 fixes; add `.json`. |
| `app/local/permit/[id]/page.tsx` + `CopyChip.tsx` | permit detail | Phase-3 area, but exists; keep. |

**New routes/services to build (Phase 1):**
`app/local/live` (§12.1, D1), `app/local/map` (§12.2, MapLibre), `app/local/events/[id]`
(§12.3), `app/local/admin` (§12.4, behind existing admin auth), and the dispatcher
`app/api/local/dispatch` (**D4** — per-minute, runs due sources; ⚠️ run them
**concurrently** and cap total within the serverless `maxDuration`).

---

## 5. Migration order (D1) — current state per section

| Section | Current | Phase-1 target | Rebuild phase |
|---|---|---|---|
| Need To Know | live synth | **→ events store** | Phase 1 |
| Roads & Incidents | live (511+Caltrans) | **→ events store** | Phase 1 |
| Your Environment | live (NWS/USGS/NOAA/AirNow/FIRMS) | **→ observations** (+ tides/gauges/reservoir) | Phase 1 |
| Local Reporting | live (PRL/Pacific Sun/KQED) | live, with §16.3 fixes | Phase 2 |
| Changing Around You | live (permits) | live, with §16.3 fixes | Phase 3 |
| Local Blindspot | live (county-wide) | live, **geo-filtered per town** (§16.3) | Phase 3 |
| Your Government | live (agendas+LLM) | live | Phase 3 |

---

## 6. Net-new work for Phase 0/1 (nothing above covers)

- **Region polygons** (4: North/Central/Southern/West Marin) as a Phase-0 gazetteer
  seed — **required by D11** but absent from §8's seed list.
- Full §3 table set + `local_event_type` seed (§6) + gazetteer seed (§8) + source
  registry rows (§11, incl. the dropped/inactive ones with `status_note`).
- The §5.2 pipeline stages (archive → dedupe → geolocate → observations → change-detect
  → match/create → verify → score → publish/hold), each idempotent.
- Trust model functions (§4.1–4.4) with unit tests.
- Importance (§9), publishing rules (§10), headline templates + LLM validation (§7.5).
- `/local/map`, `/local/events/[id]`, `/local/admin`, `/local/live`, dispatcher.
- `scripts/local/audit-towns.ts` (§16.4) + `docs/local/DECISIONS.md`, `SOURCES.md`.

---

## 7. Sources already proven this build (reuse endpoints/keys)

NWS alerts + point forecast · USGS quakes (2.5-day feed) · NOAA CO-OPS tides
(9415020) · Caltrans D4 CCTV + LCS (public JSON) · 511 SF Bay traffic
(`BAY511_API_KEY`) · AirNow + PurpleAir · NASA FIRMS (`NASA_FIRMS_MAP_KEY`) · CAL FIRE
incidents (public JSON) · Marin County permits (Socrata `mkbn-caye`) · Marin BoS agendas
(Granicus). See `docs/local-sources.md` for the existing source manifest.
