# My Local — Event History (`/local/history`)

**Status:** approved design (2026-09-29)
**Depends on:** the ingestion pipeline + event store (PRs #96–#114). No schema changes.

## Purpose

An owner-gated archive of what has *happened* around you — road closures that
cleared, weather/coastal-flood advisories that expired, fires contained, AQI spikes
that passed — grouped by the same sections as `/local`. It answers "what's been
going on in Marin lately," using the resolved/archived events the pipeline already
produces.

Distinct from the two existing owner pages:
- `/local` — what's happening **now** (active, published events + live snapshot).
- `/local/status` — pipeline **health** (sources, runs, counts).
- `/local/history` — what has **concluded** (this spec).

No waiting and no new data collection: resolved/archived events already exist
(absence resolution + the §7.4 time-based sweep have been running since the cron
went live).

## Scope decisions

1. **Concluded-only.** Show events with `lifecycle_state IN ('resolved','archived')`.
   Active events are already on `/local`; including them here would duplicate that
   surface and blur the "this is the past" framing.
2. **Published-only.** `publish_state = 'published'`. Held/rejected events never
   appear (that is what `/local/review` is for).
3. **30-day window.** Order by `resolved_at` (fallback `latest_update_at`) within
   the last 30 days — matches `archive_after_days`. Archived events older than the
   window still exist in the DB but are not shown.
4. **Per-section cap** ~15 rows; only sections with history render.
5. **Owner-gated**, Marin-wide. Shared/location-scoped history is out of scope.

## Data

Reads `local_events` only. No schema change.

```
select id, title, headline, event_type, status,
       first_seen_at, first_detected_at, latest_update_at, resolved_at,
       geo, consequence_score, confidence, summary
  from local_events
 where publish_state = 'published'
   and lifecycle_state in ('resolved','archived')
   and coalesce(resolved_at, latest_update_at) >= now() - interval '30 days'
 order by coalesce(resolved_at, latest_update_at) desc
 limit 300
```

Fetch one recency-ordered batch (overall cap 300 — comfortably more than 30 days
of Marin events), then group and apply the per-section cap in code. No per-section
SQL; a single query keeps it simple.

Rows are mapped to the app `LocalEvent` via the existing
`mapStoredEventToLocalEvent` (store-read.ts) so display stays consistent with the
live sections. Sources are attached the same way `readPublishedEvents` does (one
batched `local_event_source → local_source_item → local_source` join), reused —
extract that join helper from store-read so both callers share it.

## Section grouping

Spec `event_type` → history section (mirrors `LocalDigestView` identity/accents):

| Section | icon | accent | event types |
|---|---|---|---|
| Roads & Incidents | 🚧 | #EA580C | road_closure, road_incident, transit_disruption |
| Fire | 🔥 | #DC2626 | fire_incident, fire_detection |
| Weather & Water | 🌊 | #0F766E | weather_alert, coastal_flood, stream_high_water |
| Air Quality | 🌲 | #16A34A | air_quality |
| Utilities | ⚡ | #CA8A04 | power_outage |
| Development | 🏗️ | #16A34A | development_update |
| Government | 🏛️ | #2563EB | government_action |
| Safety | 🚨 | #DC2626 | public_safety |

Event types not listed fall through to no section (not shown). Sections render in
the order above; empty sections are omitted.

## Components / files

- **`lib/local/history.ts`**
  - `HISTORY_SECTIONS` — ordered section definitions (key, label, icon, accent,
    `eventTypes: string[]`).
  - `formatActiveDuration(startIso, endIso): string | undefined` — **pure, tested**:
    e.g. "active 3h", "active 2 days"; undefined when unknown.
  - `groupHistoryBySection(events: HistoryEvent[]): HistorySectionView[]` —
    **pure, tested**: buckets mapped events into the sections above, preserving
    input order (already sorted by recency), applying the per-section cap.
  - `readEventHistory(sb, { sinceDays = 30, perSectionLimit = 15 }): Promise<HistorySectionView[]>`
    — the DB read + map + group (thin I/O wrapper).
  - `HistoryEvent` = the mapped `LocalEvent` plus `resolvedAt?: string` and
    `firstDetectedAt?: string` (needed for the duration + "resolved when" line).
- **`lib/local/store-read.ts`** — extract the private `sourcesByEvent` join into a
  shared helper (or export it) so `readEventHistory` reuses it rather than
  duplicating the join. No behavior change to `readPublishedEvents`.
- **`app/local/history/page.tsx`** — owner-gated server component (redirect
  `/admin/login` when unauthenticated), reads via the service client, renders each
  non-empty section with the shared eyebrow/accent treatment and a row per event:
  headline (+ source link), "active <duration> · resolved <when>", confidence +
  source label. Empty state: "No recent history yet."
- **`app/local/page.tsx`** — add `History →` link to the owner-only `note`
  alongside `Review queue →` and `Pipeline status →`.

## Testing

- `history.test.ts`
  - `formatActiveDuration`: minutes/hours/days rounding; missing/invalid inputs → undefined.
  - `groupHistoryBySection`: correct bucketing by event type; unknown types dropped;
    per-section cap enforced; input recency order preserved; empty sections absent.
- `next build` + `tsc` green; full `lib/local` suite passes.

The DB read (`readEventHistory`) and the page are I/O/rendering and are not unit-
tested (consistent with the rest of the ingestion code — pure logic is tested, thin
DB wrappers are not).

## Out of scope (YAGNI — clean later adds)

- Per-event expandable lifecycle timelines from `local_event_update`
  (detected → status_change → resolved).
- Metric trend charts / the §7.1 observation time-series.
- Shared / location-scoped (town/ZIP) history.
- Filter / search UI, pagination beyond the per-section cap.
- Any new table or column.
