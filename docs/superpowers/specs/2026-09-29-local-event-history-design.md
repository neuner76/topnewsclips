# My Local — Event History (`/local/history`)

**Status:** approved design, revised (2026-09-29)
**Depends on:** the ingestion pipeline + event store (PRs #96–#114).
**Schema:** no table or column changes. One additive jsonb key is written going forward (see §4.2).

## 1. Purpose

An owner-gated archive of what has happened around you, grouped by the same sections as `/local`. Examples include road closures that cleared, weather and coastal-flood advisories that expired, fires that were contained, AQI spikes that passed, and notable reservoir changes. It answers "what's been going on in Marin lately," using the resolved and archived events the pipeline already produces.

This page is distinct from the two existing owner pages:

- `/local` shows what's happening now: active, published events plus the live snapshot.
- `/local/status` shows pipeline health: sources, runs and counts.
- `/local/history` shows what has concluded (this spec).

No new data collection is needed. Resolved and archived events already exist, because absence resolution and the §7.4 time-based sweep have been running since the cron went live.

## 2. Scope decisions

- **Concluded events only.** Show events with `lifecycle_state IN ('resolved','archived')`. Active events already appear on `/local`, and repeating them here would blur the "this is the past" framing.
- **Published events only.** Require `publish_state = 'published'`. Held and rejected events never appear here; `/local/review` handles those.
- **30-day window.** Filter by `coalesce(resolved_at, latest_update_at)` within the last 30 days, matching `archive_after_days`. Older archived events stay in the database but aren't shown.
- **Per-section cap of 15 rows, enforced per section in the database** (see §3). Only sections with history render.
- **Routine planned lane closures are summarized, not listed** (see §5).
- **Owner-gated and Marin-wide.** Shared or location-scoped history is out of scope.

## 3. Data

The page reads `local_events` and joins `local_event_update`, plus the existing source join. There are no schema changes.

### 3.1 Per-section queries

Run one small query per section in parallel (`Promise.all`), so that a high-volume section can never crowd another out of a shared batch. The section-to-event-type mapping lives in TypeScript (`HISTORY_SECTIONS`) and is passed in as `$types`. It is not duplicated in SQL.

```sql
select id, title, headline, event_type, status,
       first_seen_at, first_detected_at, started_at, latest_update_at, resolved_at,
       geo, consequence_score, summary
  from local_events
 where publish_state = 'published'
   and lifecycle_state in ('resolved','archived')
   and event_type = any($types)
   and coalesce(resolved_at, latest_update_at) >= now() - interval '30 days'
   and not ($excludeRoutine and <routine-closure predicate, §5>)
 order by coalesce(resolved_at, latest_update_at) desc
 limit $perSectionLimit
```

If `started_at` isn't a column in the repo's `local_events`, drop it from the select and read the source-provided start time from wherever the mapper already gets it. If there is none, `first_detected_at` is used (§4.1).

The query does not select `confidence`. Its absence from the history rows is deliberate (§6).

### 3.2 Batched joins (one query each, across all returned event IDs)

- **Sources:** the existing `local_event_source → local_source_item → local_source` join. Extract it from `store-read.ts` into a shared helper so that `readPublishedEvents` and `readEventHistory` both call it. `readPublishedEvents` must behave exactly as before.
- **Resolution row:** for each event, the most recent `local_event_update` row with `kind = 'resolved'`, returning its `at`, `text` and `new_value`.
- **Correction count:** `count(*)` of `local_event_update` rows with `kind = 'correction'`, grouped by `event_id`.

### 3.3 Routine-closure summary query

This is a single aggregate over the same 30-day window, covering only events that match the routine-closure predicate (§5). It returns the total count and the top three road names by frequency, using the same road/route field the live Roads section displays (e.g. "US-101", "SR-1").

### 3.4 Mapping

Map rows to the app's `LocalEvent` through the existing `mapStoredEventToLocalEvent` (`store-read.ts`), so display stays consistent with the live sections.

## 4. Durations and resolution wording

### 4.1 Start time

Use the source-provided start time (`started_at`) when present. Otherwise use `first_detected_at`. Never use `first_seen_at` for duration.

### 4.2 Resolution kind

The way an event was resolved determines both the end time and the wording. There are three kinds:

| kind | how it happened | end time used | row wording |
|---|---|---|---|
| `feed_absent` | the source stopped listing it (confirmed absent on 2 fetches) | `resolved_at` | "cleared ~{time}" |
| `explicit_end` | the source gave an end or expiry time | `resolved_at` | "ended {time}" |
| `time_sweep` | §7.4 timeout with no further updates | `latest_update_at` | "no updates after {time}" |

**Going forward:** the resolver code (absence resolution and the §7.4 sweep) writes `new_value.reason` with one of the three values above on the `resolved` `local_event_update` row. This adds a jsonb key and requires no schema change.

**Existing rows without `reason`:** infer the kind as follows.
1. If the event type has an explicit expiry (for example, `weather_alert` and `coastal_flood`) and `resolved_at` is within 5 minutes of that expiry, the kind is `explicit_end`.
2. Otherwise, if `resolved_at − latest_update_at ≥ 60 minutes`, the kind is `time_sweep`.
3. Otherwise, the kind is `feed_absent`.

### 4.3 Duration display

`formatActiveDuration(startIso, endIso)` uses the start time from §4.1 and the end time from §4.2:
- Under 1 hour: "active {n} min". From 1 to under 48 hours: "active {n}h". From 48 hours on: "active {n} days".
- Round to the nearest unit.
- Return `undefined` if either input is missing or invalid, or if end is before start.

For `time_sweep`, prefix the duration with "at least", as in "active at least 2h". The true end time is unknown.

### 4.4 Time zone

Format all displayed times in `America/Los_Angeles`, whatever the server's time zone. Times within the last 24 hours show as "3:40 PM". Older times show as "Sep 24, 3:40 PM".

## 5. Routine planned lane closures

Planned work closures (nightly paving, shoulder work, electrical work and similar) are high-volume and low-information. Listing them would turn the Roads section into a construction log.

**Routine-closure predicate:** an event counts as routine when all of the following hold:
- `event_type = 'road_closure'`, and
- it is not a full closure, and
- it came from planned-work sources (Caltrans LCS planned work, or 511 roadwork/construction).

For "not a full closure," reuse the existing full-closure logic the live Need To Know section already applies. Do not write a second definition.

Keep these as individual rows even though they are road closures:
- full closures,
- all `road_incident` events,
- emergency work,
- any closure on SR-1, Sir Francis Drake Blvd, Lucas Valley Rd or Point Reyes–Petaluma Rd that lasted 12 hours or more.

The long-closure exception exists because those roads have few alternatives. Put the road list in config.

**Display:** the Roads & Incidents section lists the non-routine events, followed by one summary line when the §3.3 count is above zero: "Plus {n} planned lane closures, mostly {road1}, {road2}." Leave out the "mostly" clause when fewer than 3 closures exist. The summary line does not link anywhere.

## 6. Section grouping

Event types map to history sections as follows. The table mirrors the identity and accent colors in `LocalDigestView`.

| Section | icon | accent | event types |
|---|---|---|---|
| Roads & Incidents | 🚧 | #EA580C | road_closure, road_incident, transit_disruption |
| Fire | 🔥 | #DC2626 | fire_incident, fire_detection |
| Weather & Water | 🌊 | #0F766E | weather_alert, coastal_flood, stream_high_water, **reservoir_change** |
| Air Quality | 🌲 | #16A34A | air_quality |
| Utilities | ⚡ | #CA8A04 | power_outage |
| Development | 🏗️ | #16A34A | development_update |
| Government | 🏛️ | #2563EB | government_action |
| Safety | 🚨 | #DC2626 | public_safety |

- Event types not listed fall through to no section and are not shown.
- Sections render in the order above. Empty sections are omitted.
- `reservoir_change` events describe a moment, not a period. Show them without a duration, as "{headline} · {date}".
- Air Quality and Development share an accent color, as do Fire and Safety. This is intentional, because it mirrors `LocalDigestView`, and the icons distinguish the sections.

**Row content:**
- The headline, linked to the primary source.
- The duration and resolution wording from §4, e.g. "active 3h · cleared ~4:15 PM".
- The **verification label** (Confirmed / Developing / Community reports / Unverified) mapped from `status`, plus the source name. Numeric confidence is never shown, consistent with the parent spec's rule that confidence stays internal.
- A **"Corrected" badge** when the correction count is 1 or more.

## 7. Components and files

### `lib/local/history.ts`
- `HISTORY_SECTIONS`: ordered section definitions with `key`, `label`, `icon`, `accent` and `eventTypes: string[]`.
- `ROUTINE_CLOSURE_ROADS_EXEMPT`: the config road list from §5.
- `formatActiveDuration(startIso, endIso, opts?: { atLeast?: boolean }): string | undefined`. A pure function (§4.3).
- `inferResolutionKind(event, resolvedUpdate): 'feed_absent' | 'explicit_end' | 'time_sweep'`. A pure function: it reads `new_value.reason` and falls back to the §4.2 heuristic.
- `formatResolution(kind, resolvedAt, latestUpdateAt, tz): string`. A pure function (§4.2, §4.4).
- `groupHistoryBySection(events: HistoryEvent[], perSectionLimit): HistorySectionView[]`. A pure function. It buckets mapped events by section, preserves input order, applies the cap as a safeguard, and omits empty sections.
- `formatRoutineSummary(count, topRoads): string | undefined`. A pure function (§5).
- `readEventHistory(sb, { sinceDays = 30, perSectionLimit = 15 }): Promise<{ sections: HistorySectionView[]; routineSummary?: string }>`. A thin I/O wrapper that runs the per-section queries, the batched joins and the summary query, then maps and groups the results.
- `HistoryEvent` is the mapped `LocalEvent` plus `startedAt?`, `firstDetectedAt?`, `resolvedAt?`, `latestUpdateAt?`, `resolutionKind`, `correctionCount` and `verificationLabel`.

### `lib/local/store-read.ts`
- Extract the private `sourcesByEvent` join into an exported shared helper. `readPublishedEvents` must behave exactly as before.

### Resolver code (absence resolution + §7.4 sweep)
- Write `new_value.reason` on each new `resolved` update (§4.2). Make no other behavior change.

### `app/local/history/page.tsx`
- An owner-gated server component that redirects to `/admin/login` when the user is not authenticated.
- It reads data through the service client.
- It renders each non-empty section with the shared eyebrow/accent treatment, one row per event (§6), and the routine summary line under Roads & Incidents.
- Empty state: "No recent history yet."

### `app/local/page.tsx`
- Add a "History →" link to the owner-only note, alongside "Review queue →" and "Pipeline status →".

## 8. Testing

`history.test.ts`:
- `formatActiveDuration`: rounding for minutes, hours and days; the "at least" prefix; missing or invalid inputs return `undefined`; end before start returns `undefined`.
- `inferResolutionKind`: an explicit `reason` wins; the heuristic handles weather expiry, the 60-minute sweep gap and the `feed_absent` default.
- `formatResolution`: correct wording for each kind; times render in Pacific time from UTC inputs, including across a DST boundary.
- `groupHistoryBySection`: correct bucketing, including `reservoir_change` going to Weather & Water; unknown types are dropped; the cap is enforced; input order is preserved; empty sections are absent.
- `formatRoutineSummary`: the "mostly" clause appears only when the count is 3 or more; a count of zero returns `undefined`.
- Resolver: a unit test that a sweep-resolved event's `resolved` update carries `reason: 'time_sweep'`, and an absence-resolved event's carries `reason: 'feed_absent'`.

Also required: `next build` and `tsc` pass, and the full `lib/local` suite passes.

The DB read (`readEventHistory`) and the page are I/O and rendering, so they are not unit-tested. This matches the rest of the ingestion code, where pure logic is tested and thin DB wrappers are not.

## 9. Acceptance

- A contained fire, an expired weather advisory and a cleared power outage from the last 30 days all appear, even when more than 300 road events exist in the same window.
- No routine planned lane closure appears as an individual row. The summary line reports them instead.
- No row shows a numeric confidence value.
- A sweep-resolved incident reads "active at least {n} · no updates after {time}", never a duration inflated by the timeout.

## 10. Out of scope (clean to add later)

- Expandable per-event lifecycle timelines from `local_event_update`.
- Metric trend charts and the §7.1 observation time series.
- Shared or location-scoped (town/ZIP) history.
- Filter or search UI, and pagination beyond the per-section cap.
- Any new table or column.
