# My Local — Decisions Log

_The §0 / §14 deliverable. Records the build decisions and any substitutions from the
spec's named technology. Accepted decisions D1–D12 come from spec §0.1 (v1.1) and are
binding; "Open" items are flagged residuals to resolve before or during Phase 0._

---

## Accepted (spec §0.1 v1.1)

**D1 — One product, one store, strangler migration.** No parallel products. The owner
briefing (`/local`) and per-town share briefings (`/local/share/{slug}`) stay the product
surface. Each section keeps live-computing (existing 10-min `unstable_cache`) until its
data lands in the store, then flips to reading the store, via a per-section flag in
`lib/local/config`. A section reads store **or** live, never both. Migration order:
Need To Know + Roads (events) → Your Environment (observations) → Local Reporting (Ph2) →
Changing Around You + Blindspot (Ph3). The §12.1 countywide feed ships at **`/local/live`**
and does **not** replace `/local`.

**D2 — §15 vs §16.** §16 fixes apply to the existing live pages **now**. §15 defers only
the *rebuild* of permits, Blindspot and Local Reporting inside the event model. Both hold.

**D3 — Fire.** CAL FIRE becomes a Phase-1 adapter producing `fire_incident` events
(`auto_publish`=yes for CAL FIRE-listed incidents; evidence level 1). Journalism-derived
fire events arrive in Phase 2. Phase-1 interim bridge: a Tier 1–6 local story in the
town's region, published in the last 7 days, whose title matches fire terms
(fire/blaze/brush fire/acres/evacuation) with **no** CAL FIRE event within 10 km, shows in
Need To Know as "Reported by {outlet}, {date}" linking to the story — never phrased as
active/ongoing.

**D4 — Scheduler.** One dispatcher route `app/api/local/dispatch` runs **every minute** and
executes whichever sources are due (from `crawl_interval_seconds` + `last_success_at`),
each with its own timeout. Trigger via Vercel Pro cron (per-minute); if Pro isn't approved,
trigger the same route from Supabase `pg_cron` + `pg_net`. **No** GitHub Actions /
cron-job.org for local polling. Min interval per source = 5 min. Every run logs to
`local_job_runs`.

**D5 — Schema & paths.** Keep repo conventions: `local_`-prefixed tables in the **public**
schema (no `local` Postgres schema); code in `lib/local/` and `app/local/`. Reuse and
extend existing tables (`local_events`, `local_geocode_cache`, `local_saved_places`,
`local_llm_spend`) rather than duplicating.

**D6 — Env vars.** Reuse `BAY511_API_KEY`, `AIRNOW_API_KEY`, `PURPLEAIR_API_KEY`,
`NASA_FIRMS_MAP_KEY`. Do **not** introduce `LOCAL_511_API_KEY` / `LOCAL_AIRNOW_API_KEY`.

**D7 — Adapters.** **Wrap** existing live adapters (NWS, USGS quakes, NOAA tides, Caltrans
D4 LCS, AirNow/PurpleAir, 511, CAL FIRE, FIRMS, county permits) in the §5.1 interface;
don't rewrite. New in Phase 1: Marin Water storage, USGS stream gauges, 511 transit
alerts, PG&E outages (expect `active=false` — WAF; record why). **Drop CHP CAD**
(`active=false`, note "redundant with 511; brittle scrape").

**D8 — Tiers.** "10-tier scale" = existing `source_tier` (int) + `source_type` (text) on
`featured_journalists`. Reuse; no new enum.

**D9 — Verification rule 4** reads "levels 3 and 5" (level 4 is an event-level outcome,
never assigned to a source item).

**D10 — Earthquakes.** One rule everywhere: **M3.5+ within 50 mi** (the live rule). When
nothing qualifies, show "No notable earthquakes nearby".

**D11 — Distance = region grouping, not routing.** Four regions (North/Central/Southern/
West Marin) from the `/local/share` index, assigned per town and, for items, by
point-in-polygon on region polygons. An item shows on a town page only if within the
town's radius **and** in the same region. Exception: countywide items (weather alerts,
AQI, reservoirs, US-101 closures) show everywhere.

**D12 — Geocoding order.** source coordinates → gazetteer alias match →
`local_geocode_cache` → U.S. Census geocoder (free, address-level, no key) → Nominatim
(≤1 req/s) as last resort. Cache every result, **including misses** (30-day retry).

---

## Repo substitutions (D5/D6/D7 in practice)

| Spec says | Repo uses | Why |
|---|---|---|
| DB schema `local` | `local_`-prefixed tables in `public` | Existing convention (migration `20260907_local_schema.sql`). |
| `src/local/` | `lib/local/` + `app/local/` | Existing layout. |
| `local.job_runs`, `local.raw_payload`, `local.geocode_cache` | `local_job_runs`, `local_raw_payload` (or Supabase Storage), `local_geocode_cache` | Prefix convention. |
| `LOCAL_511_API_KEY` / `LOCAL_AIRNOW_API_KEY` | `BAY511_API_KEY` / `AIRNOW_API_KEY` (+ `PURPLEAIR_API_KEY`) | Already configured in Vercel. |
| CHP CAD source | dropped | Redundant with 511; brittle ASP.NET scrape. |
| model client (LLM) | existing Anthropic client (as in `lib/digest.ts`) | Already integrated. |

---

## Open — resolve before/during Phase 0

- **O1 — Region polygons seed.** D11 needs 4 Marin region polygons for point-in-polygon,
  but §8's gazetteer seed list omits them. Add them as a Phase-0 seed artifact (source:
  derived from city/community centroids or a hand-drawn N/C/S/W split; record provenance).
- **O2 — Dispatcher concurrency budget.** D4's per-source timeouts don't bound the single
  serverless invocation's wall-clock. Decide: run due sources **concurrently**
  (`Promise.allSettled`) and cap the batch within the function `maxDuration` (Vercel Pro
  default 60s, up to 300s), or enqueue overflow to the next minute.
- **O3 — Raw archive + observations storage.** §5.3 (90-day raw payloads) + §3.5
  (observations kept forever) grow fast. Decide Supabase **Storage** (object) vs a
  `bytea` table for raw; confirm the observations index/partition strategy.
- **O4 — Name-stripping method (§10).** Phase-1 sources are structured/official (CHP
  dropped), so exposure is low; decide a light heuristic vs a real NER pass, and where it
  runs in the pipeline.
- **O5 — Stale body text.** Spec §2/§3/§5.1/§11/§12.1 still contain pre-v1.1 statements
  (CHP row, `LOCAL_511_API_KEY`, schema `local`, `src/local`, "`/local` — Live"). §0.1
  supersedes, but consider striking them so no one acts on the stale rows.
