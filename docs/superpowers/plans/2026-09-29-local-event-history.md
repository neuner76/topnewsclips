# My Local — Event History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/local/history` — an owner-gated, section-grouped archive of concluded (resolved/archived) published events, per the spec at `docs/superpowers/specs/2026-09-29-local-event-history-design.md`.

**Architecture:** Pure display/logic helpers in `lib/local/history.ts` (heavily unit-tested); a thin I/O reader `readEventHistory` that runs per-section queries + batched joins; an owner-gated server page `app/local/history/page.tsx`. Resolvers gain a `new_value.reason` write (via a shared pure helper) so history can word resolutions correctly. No schema changes.

**Tech Stack:** Next.js 16 App Router (server components), Supabase JS (service client), TypeScript, Vitest.

**Codebase reconciliations (grounded against the repo):**
- `local_events` has **no `started_at` column**. The source-provided start time is stored in **`first_seen_at`** (`landEventForItem` sets `first_seen_at = candidate.startedAt ?? now`); `first_detected_at` is our detection time. So duration start = `first_seen_at`, fallback `first_detected_at`. (This inverts the spec's literal "never first_seen_at", which assumed a separate `started_at` column.)
- The verification label comes from **`verification_status`** (`confirmed|developing|community_reports|unverified`), not `status`.
- Full-closure detection reuses the live regex `/full closure/i` on the event title (`lib/local/need-to-know.ts:121`).
- Routine-closure filtering runs in **TypeScript** (pure `isRoutineClosure`), not SQL — so the definition isn't duplicated. Road events are fetched (30-day window, generous cap) and partitioned in code.
- `explicit_end` is only produced when a resolver writes `reason='explicit_end'`; no such resolver exists yet, and expiry isn't stored, so the existing-row heuristic uses only the 60-min sweep-gap rule and defaults to `feed_absent`.

**Run tests with:** `npx vitest run <path>` · **typecheck:** `npx tsc --noEmit` · **build:** `npx next build`. Prefix long/network git with `rtk proxy` per repo convention.

---

## Task 1: Resolution reason helper + wire into resolvers

**Files:**
- Create: `lib/local/ingest/resolution.ts`
- Test: `lib/local/ingest/resolution.test.ts`
- Modify: `lib/local/ingest/resolve.ts` (the `local_event_update` insert), `lib/local/ingest/lifecycle.ts` (the `toResolve` `local_event_update` insert)

- [ ] **Step 1: Write the failing test**

```ts
// lib/local/ingest/resolution.test.ts
import { describe, expect, it } from 'vitest'
import { resolvedUpdateRow } from './resolution'

describe('resolvedUpdateRow', () => {
  it('builds a resolved event_update carrying the reason in new_value', () => {
    const row = resolvedUpdateRow('e1', 'feed_absent', 'No longer present in the source feed')
    expect(row).toEqual({
      event_id: 'e1',
      kind: 'resolved',
      text: 'No longer present in the source feed',
      new_value: { reason: 'feed_absent' },
    })
  })
  it('carries time_sweep', () => {
    expect(resolvedUpdateRow('e2', 'time_sweep', 'Aged out').new_value).toEqual({ reason: 'time_sweep' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/local/ingest/resolution.test.ts`
Expected: FAIL (Cannot find module './resolution').

- [ ] **Step 3: Write the implementation**

```ts
// lib/local/ingest/resolution.ts
// The three ways an event ends (§4.2 of the event-history spec). Written to the
// `resolved` local_event_update row's new_value.reason so the history view can word
// the resolution correctly. Shared by both resolvers (absence + §7.4 sweep).
export type ResolutionReason = 'feed_absent' | 'explicit_end' | 'time_sweep'

export interface ResolvedUpdateRow {
  event_id: string
  kind: 'resolved'
  text: string
  new_value: { reason: ResolutionReason }
}

export function resolvedUpdateRow(eventId: string, reason: ResolutionReason, text: string): ResolvedUpdateRow {
  return { event_id: eventId, kind: 'resolved', text, new_value: { reason } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/local/ingest/resolution.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `resolve.ts`**

In `lib/local/ingest/resolve.ts`, add the import at the top:

```ts
import { resolvedUpdateRow } from './resolution'
```

Replace the existing `local_event_update` insert (currently `ids.map(id => ({ event_id: id, kind: 'resolved', text: 'No longer present in the source feed' }))`) with:

```ts
  await sb.from('local_event_update').insert(
    ids.map(id => resolvedUpdateRow(id, 'feed_absent', 'No longer present in the source feed')),
  )
```

- [ ] **Step 6: Wire into `lifecycle.ts`**

In `lib/local/ingest/lifecycle.ts`, add the import at the top:

```ts
import { resolvedUpdateRow } from './resolution'
```

Replace the `toResolve` `local_event_update` insert (currently `toResolve.map(id => ({ event_id: id, kind: 'resolved', text: 'Aged out (no recent activity)' }))`) with:

```ts
    await sb.from('local_event_update').insert(toResolve.map(id => resolvedUpdateRow(id, 'time_sweep', 'Aged out (no recent activity)')))
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean), then:

```bash
git add lib/local/ingest/resolution.ts lib/local/ingest/resolution.test.ts lib/local/ingest/resolve.ts lib/local/ingest/lifecycle.ts
git commit -m "feat(local): write resolution reason on resolved event_update"
```

---

## Task 2: Export the shared source-join helper

**Files:**
- Modify: `lib/local/store-read.ts` (rename private `sourcesByEvent` → exported `readSourcesByEvent`)

The private `sourcesByEvent(sb, eventIds)` in `store-read.ts` returns `Map<string, LocalEvidenceSource[]>`. History needs the same join. Export it unchanged; `readPublishedEvents` must behave exactly as before (its existing tests in `store-read.test.ts` still pass).

- [ ] **Step 1: Rename + export**

In `lib/local/store-read.ts`, change the declaration `async function sourcesByEvent(` to `export async function readSourcesByEvent(`, and update its one caller inside `readPublishedEvents` (`await sourcesByEvent(sb, ...)` → `await readSourcesByEvent(sb, ...)`).

- [ ] **Step 2: Verify nothing else broke**

Run: `npx tsc --noEmit` (clean) and `npx vitest run lib/local/store-read.test.ts` (expect PASS — behavior unchanged).

- [ ] **Step 3: Commit**

```bash
git add lib/local/store-read.ts
git commit -m "refactor(local): export readSourcesByEvent for reuse"
```

---

## Task 3: history.ts scaffold — types, sections, config

**Files:**
- Create: `lib/local/history.ts`
- Test: `lib/local/history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/local/history.test.ts
import { describe, expect, it } from 'vitest'
import { HISTORY_SECTIONS, sectionForType } from './history'

describe('history sections', () => {
  it('maps event types to sections, reservoir_change → Weather & Water', () => {
    expect(sectionForType('road_closure')).toBe('roads')
    expect(sectionForType('coastal_flood')).toBe('weather')
    expect(sectionForType('reservoir_change')).toBe('weather')
    expect(sectionForType('fire_detection')).toBe('fire')
    expect(sectionForType('development_update')).toBe('development')
  })
  it('unknown types map to no section', () => {
    expect(sectionForType('mystery')).toBeUndefined()
  })
  it('has ordered unique section keys', () => {
    const keys = HISTORY_SECTIONS.map(s => s.key)
    expect(keys[0]).toBe('roads')
    expect(new Set(keys).size).toBe(keys.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/local/history.test.ts`
Expected: FAIL (Cannot find module './history').

- [ ] **Step 3: Write the scaffold**

```ts
// lib/local/history.ts
import type { LocalEvent } from './types'
import type { ResolutionReason } from './ingest/resolution'

export type ResolutionKind = ResolutionReason

export interface HistorySectionDef {
  key: string
  label: string
  icon: string
  accent: string
  eventTypes: string[]
}

// Ordered; mirrors LocalDigestView identity/accents. Air Quality/Development and
// Fire/Safety intentionally share accents (icons distinguish them), per spec §6.
export const HISTORY_SECTIONS: HistorySectionDef[] = [
  { key: 'roads', label: 'Roads & Incidents', icon: '🚧', accent: '#EA580C', eventTypes: ['road_closure', 'road_incident', 'transit_disruption'] },
  { key: 'fire', label: 'Fire', icon: '🔥', accent: '#DC2626', eventTypes: ['fire_incident', 'fire_detection'] },
  { key: 'weather', label: 'Weather & Water', icon: '🌊', accent: '#0F766E', eventTypes: ['weather_alert', 'coastal_flood', 'stream_high_water', 'reservoir_change'] },
  { key: 'air', label: 'Air Quality', icon: '🌲', accent: '#16A34A', eventTypes: ['air_quality'] },
  { key: 'utilities', label: 'Utilities', icon: '⚡', accent: '#CA8A04', eventTypes: ['power_outage'] },
  { key: 'development', label: 'Development', icon: '🏗️', accent: '#16A34A', eventTypes: ['development_update'] },
  { key: 'government', label: 'Government', icon: '🏛️', accent: '#2563EB', eventTypes: ['government_action'] },
  { key: 'safety', label: 'Safety', icon: '🚨', accent: '#DC2626', eventTypes: ['public_safety'] },
]

// Roads with few alternatives — a long closure here is kept as an individual row
// (spec §5), matched as a case-insensitive substring of the event title.
export const ROUTINE_CLOSURE_ROADS_EXEMPT = ['SR-1', 'Sir Francis Drake', 'Lucas Valley', 'Point Reyes-Petaluma', 'Point Reyes Petaluma']

const TYPE_TO_SECTION: Record<string, string> = Object.fromEntries(
  HISTORY_SECTIONS.flatMap(s => s.eventTypes.map(t => [t, s.key])),
)

export function sectionForType(specEventType: string): string | undefined {
  return TYPE_TO_SECTION[specEventType]
}

// A concluded event prepared for the history UI.
export interface HistoryEvent {
  event: LocalEvent          // display fields (title, sources, summary, app eventType)
  specEventType: string      // raw local_events.event_type — used for section bucketing
  startedAt?: string         // local_events.first_seen_at (source-provided start)
  firstDetectedAt?: string   // local_events.first_detected_at
  resolvedAt?: string        // local_events.resolved_at
  latestUpdateAt?: string    // local_events.latest_update_at (raw)
  resolutionKind: ResolutionKind
  correctionCount: number
  verificationLabel: string
}

export interface HistorySectionView {
  def: HistorySectionDef
  events: HistoryEvent[]
}
```

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run lib/local/history.test.ts` (expect PASS, 3 tests). Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): history sections + types scaffold"
```

---

## Task 4: formatActiveDuration

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { formatActiveDuration } from './history'

describe('formatActiveDuration', () => {
  const start = '2026-09-28T12:00:00Z'
  it('minutes under an hour', () => {
    expect(formatActiveDuration(start, '2026-09-28T12:40:00Z')).toBe('active 40 min')
  })
  it('hours from 1h to under 48h', () => {
    expect(formatActiveDuration(start, '2026-09-28T15:00:00Z')).toBe('active 3h')
    expect(formatActiveDuration(start, '2026-09-29T23:00:00Z')).toBe('active 35h')
  })
  it('days from 48h on', () => {
    expect(formatActiveDuration(start, '2026-09-30T12:00:00Z')).toBe('active 2 days')
  })
  it('at-least prefix for time_sweep', () => {
    expect(formatActiveDuration(start, '2026-09-28T14:00:00Z', { atLeast: true })).toBe('active at least 2h')
  })
  it('undefined for missing/invalid/end-before-start', () => {
    expect(formatActiveDuration(undefined, start)).toBeUndefined()
    expect(formatActiveDuration(start, undefined)).toBeUndefined()
    expect(formatActiveDuration(start, 'nope')).toBeUndefined()
    expect(formatActiveDuration('2026-09-28T15:00:00Z', start)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/local/history.test.ts` → FAIL (formatActiveDuration not exported).

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function formatActiveDuration(startIso?: string, endIso?: string, opts: { atLeast?: boolean } = {}): string | undefined {
  if (!startIso || !endIso) return undefined
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined
  const minutes = (end - start) / 60_000
  const prefix = opts.atLeast ? 'active at least' : 'active'
  if (minutes < 60) return `${prefix} ${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 48) return `${prefix} ${Math.round(hours)}h`
  return `${prefix} ${Math.round(hours / 24)} days`
}
```

- [ ] **Step 4: Run + commit**

Run: `npx vitest run lib/local/history.test.ts` (PASS). Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): formatActiveDuration"
```

---

## Task 5: formatPacificTime

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { formatPacificTime } from './history'

describe('formatPacificTime (America/Los_Angeles)', () => {
  const now = new Date('2026-09-29T20:00:00Z') // 1:00 PM PDT
  it('within 24h shows time only, in Pacific', () => {
    // 2026-09-29T19:40Z = 12:40 PM PDT
    expect(formatPacificTime('2026-09-29T19:40:00Z', now)).toBe('12:40 PM')
  })
  it('older than 24h shows date + time', () => {
    // 2026-09-24T22:40Z = 3:40 PM PDT
    expect(formatPacificTime('2026-09-24T22:40:00Z', now)).toBe('Sep 24, 3:40 PM')
  })
  it('handles a winter (PST) instant across DST', () => {
    const winterNow = new Date('2026-01-15T20:00:00Z')
    // 2026-01-15T19:40Z = 11:40 AM PST
    expect(formatPacificTime('2026-01-15T19:40:00Z', winterNow)).toBe('11:40 AM')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/local/history.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
const PACIFIC_TZ = 'America/Los_Angeles'
const TIME_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function formatPacificTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const within24h = now.getTime() - t < 24 * 3_600_000 && now.getTime() - t >= 0
  // DATE_TIME_FMT yields e.g. "Sep 24, 3:40 PM"; TIME_FMT yields "12:40 PM".
  return within24h ? TIME_FMT.format(t) : DATE_TIME_FMT.format(t)
}
```

Note: `Intl.DateTimeFormat` with `month/day/hour/minute` renders "Sep 24, 3:40 PM" in `en-US`. If a Node ICU quirk renders it differently, normalize in the formatter options — do not post-process with string surgery.

- [ ] **Step 4: Run + commit**

Run: `npx vitest run lib/local/history.test.ts` (PASS). Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): formatPacificTime"
```

---

## Task 6: inferResolutionKind

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { inferResolutionKind } from './history'

describe('inferResolutionKind', () => {
  it('explicit reason wins', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T12:00:00Z', latestUpdateAt: '2026-09-28T11:59:00Z', reason: 'time_sweep' })).toBe('time_sweep')
    expect(inferResolutionKind({ reason: 'explicit_end' })).toBe('explicit_end')
  })
  it('60-minute gap between latest update and resolved → time_sweep', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T13:30:00Z', latestUpdateAt: '2026-09-28T12:00:00Z' })).toBe('time_sweep')
  })
  it('small gap defaults to feed_absent', () => {
    expect(inferResolutionKind({ resolvedAt: '2026-09-28T12:10:00Z', latestUpdateAt: '2026-09-28T12:00:00Z' })).toBe('feed_absent')
    expect(inferResolutionKind({})).toBe('feed_absent')
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/local/history.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
const SWEEP_GAP_MS = 60 * 60_000 // §4.2: latest_update → resolved ≥ 60 min ⇒ time_sweep

export function inferResolutionKind(args: { resolvedAt?: string; latestUpdateAt?: string; reason?: string | null }): ResolutionKind {
  const r = args.reason
  if (r === 'feed_absent' || r === 'explicit_end' || r === 'time_sweep') return r
  const resolved = args.resolvedAt ? Date.parse(args.resolvedAt) : NaN
  const latest = args.latestUpdateAt ? Date.parse(args.latestUpdateAt) : NaN
  if (Number.isFinite(resolved) && Number.isFinite(latest) && resolved - latest >= SWEEP_GAP_MS) return 'time_sweep'
  return 'feed_absent'
}
```

(Note: the spec's expiry-based `explicit_end` heuristic is intentionally omitted — no expiry is stored on `local_events`. `explicit_end` only appears when a resolver writes `reason='explicit_end'`.)

- [ ] **Step 4: Run + commit** — `npx vitest run lib/local/history.test.ts` (PASS). Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): inferResolutionKind"
```

---

## Task 7: formatResolution

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { formatResolution } from './history'

describe('formatResolution', () => {
  const now = new Date('2026-09-29T20:00:00Z')
  it('feed_absent → cleared ~time', () => {
    expect(formatResolution('feed_absent', '2026-09-29T19:40:00Z', undefined, now)).toBe('cleared ~12:40 PM')
  })
  it('explicit_end → ended time', () => {
    expect(formatResolution('explicit_end', '2026-09-29T19:40:00Z', undefined, now)).toBe('ended 12:40 PM')
  })
  it('time_sweep → no updates after latest_update time', () => {
    expect(formatResolution('time_sweep', '2026-09-29T19:40:00Z', '2026-09-29T18:40:00Z', now)).toBe('no updates after 11:40 AM')
  })
})
```

- [ ] **Step 2: Run to verify fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function formatResolution(kind: ResolutionKind, resolvedAt?: string, latestUpdateAt?: string, now: Date = new Date()): string {
  if (kind === 'time_sweep') {
    const t = latestUpdateAt ?? resolvedAt
    return t ? `no updates after ${formatPacificTime(t, now)}` : 'resolved'
  }
  if (!resolvedAt) return 'resolved'
  const when = formatPacificTime(resolvedAt, now)
  return kind === 'explicit_end' ? `ended ${when}` : `cleared ~${when}`
}
```

- [ ] **Step 4: Run + commit** — PASS. Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): formatResolution"
```

---

## Task 8: verificationLabel

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { verificationLabel } from './history'

describe('verificationLabel (from verification_status)', () => {
  it('maps the four statuses', () => {
    expect(verificationLabel('confirmed')).toBe('Confirmed')
    expect(verificationLabel('developing')).toBe('Developing')
    expect(verificationLabel('community_reports')).toBe('Community reports')
    expect(verificationLabel('unverified')).toBe('Unverified')
  })
  it('defaults null/unknown to Unverified', () => {
    expect(verificationLabel(null)).toBe('Unverified')
    expect(verificationLabel('weird')).toBe('Unverified')
  })
})
```

- [ ] **Step 2: Run to verify fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function verificationLabel(verificationStatus?: string | null): string {
  switch (verificationStatus) {
    case 'confirmed': return 'Confirmed'
    case 'developing': return 'Developing'
    case 'community_reports': return 'Community reports'
    default: return 'Unverified'
  }
}
```

- [ ] **Step 4: Run + commit** — PASS. Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): verificationLabel"
```

---

## Task 9: extractRoadName + isRoutineClosure

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { extractRoadName, isRoutineClosure } from './history'

describe('extractRoadName', () => {
  it('pulls the route token from the title', () => {
    expect(extractRoadName('US-101 South — Lane closure near Novato')).toBe('US-101')
    expect(extractRoadName('SR-1 North / South — Lane closure near Marshall')).toBe('SR-1')
  })
  it('falls back to the whole leading phrase when no route pattern', () => {
    expect(extractRoadName('Sir Francis Drake Blvd — Lane closure')).toBe('Sir Francis Drake Blvd')
  })
})

describe('isRoutineClosure (spec §5)', () => {
  const base = { specEventType: 'road_closure', title: 'US-101 South — Lane closure near Novato', summary: 'AC Paving/Overlay', startedAt: '2026-09-28T00:00:00Z', resolvedAt: '2026-09-28T06:00:00Z' }
  it('a planned partial US-101 lane closure is routine', () => {
    expect(isRoutineClosure(base)).toBe(true)
  })
  it('full closures are NOT routine', () => {
    expect(isRoutineClosure({ ...base, title: 'US-101 South — Full closure near Mill Valley' })).toBe(false)
  })
  it('road_incident is never routine', () => {
    expect(isRoutineClosure({ ...base, specEventType: 'road_incident' })).toBe(false)
  })
  it('emergency work is NOT routine', () => {
    expect(isRoutineClosure({ ...base, summary: 'Emergency slide repair' })).toBe(false)
  })
  it('a long closure (≥12h) on an exempt road is NOT routine', () => {
    expect(isRoutineClosure({ ...base, title: 'SR-1 North — Lane closure near Marshall', resolvedAt: '2026-09-28T18:00:00Z' })).toBe(false)
  })
  it('a short closure on an exempt road IS routine', () => {
    expect(isRoutineClosure({ ...base, title: 'SR-1 North — Lane closure near Marshall', resolvedAt: '2026-09-28T04:00:00Z' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function extractRoadName(title: string): string {
  const head = title.split('—')[0].trim()
  const route = head.match(/^(US-?\d+|SR-?\d+|I-?\d+|CA-?\d+)/i)
  return route ? route[1].toUpperCase().replace(/([A-Z]+)-?(\d+)/, '$1-$2') : head
}

export interface RoutineClosureInput {
  specEventType: string
  title: string
  summary?: string
  startedAt?: string
  resolvedAt?: string
}

// §5: routine = a planned, non-full road_closure that isn't emergency work and
// isn't a long (≥12h) closure on a low-alternative road. Full-closure detection
// reuses the live /full closure/i title convention (need-to-know.ts).
export function isRoutineClosure(e: RoutineClosureInput): boolean {
  if (e.specEventType !== 'road_closure') return false
  if (/full closure/i.test(e.title)) return false
  const text = `${e.title} ${e.summary ?? ''}`
  if (/emergenc/i.test(text)) return false
  const onExempt = ROUTINE_CLOSURE_ROADS_EXEMPT.some(r => e.title.toLowerCase().includes(r.toLowerCase()))
  if (onExempt && e.startedAt && e.resolvedAt) {
    const hours = (Date.parse(e.resolvedAt) - Date.parse(e.startedAt)) / 3_600_000
    if (Number.isFinite(hours) && hours >= 12) return false
  }
  return true
}
```

- [ ] **Step 4: Run + commit** — PASS. Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): isRoutineClosure + extractRoadName"
```

---

## Task 10: formatRoutineSummary

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { formatRoutineSummary } from './history'

describe('formatRoutineSummary (spec §5)', () => {
  it('undefined when count is zero', () => {
    expect(formatRoutineSummary(0, [])).toBeUndefined()
  })
  it('no "mostly" clause under 3', () => {
    expect(formatRoutineSummary(2, ['US-101'])).toBe('Plus 2 planned lane closures.')
    expect(formatRoutineSummary(1, ['US-101'])).toBe('Plus 1 planned lane closure.')
  })
  it('adds "mostly" with the top 2 roads at 3+', () => {
    expect(formatRoutineSummary(9, ['US-101', 'SR-1', 'I-580'])).toBe('Plus 9 planned lane closures, mostly US-101, SR-1.')
  })
})
```

- [ ] **Step 2: Run to verify fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function formatRoutineSummary(count: number, topRoads: string[]): string | undefined {
  if (count <= 0) return undefined
  const noun = count === 1 ? 'closure' : 'closures'
  const base = `Plus ${count} planned lane ${noun}`
  if (count >= 3 && topRoads.length > 0) return `${base}, mostly ${topRoads.slice(0, 2).join(', ')}.`
  return `${base}.`
}
```

- [ ] **Step 4: Run + commit** — PASS. Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): formatRoutineSummary"
```

---

## Task 11: groupHistoryBySection

**Files:** Modify `lib/local/history.ts`, `lib/local/history.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to lib/local/history.test.ts
import { groupHistoryBySection, type HistoryEvent } from './history'

function he(specEventType: string, id: string): HistoryEvent {
  return {
    event: { id, title: id, eventType: 'other', status: 'resolved', firstSeenAt: '', latestUpdateAt: '', geo: {}, consequenceScore: 0, confidence: 'medium', sources: [] },
    specEventType, resolutionKind: 'feed_absent', correctionCount: 0, verificationLabel: 'Confirmed',
  }
}

describe('groupHistoryBySection', () => {
  it('buckets by section, keeps section order, omits empty, drops unknown types', () => {
    const events = [he('coastal_flood', 'a'), he('road_closure', 'b'), he('mystery', 'c'), he('reservoir_change', 'd')]
    const out = groupHistoryBySection(events, 15)
    expect(out.map(s => s.def.key)).toEqual(['roads', 'weather']) // roads before weather; air/fire/etc omitted
    expect(out.find(s => s.def.key === 'weather')!.events.map(e => e.event.id)).toEqual(['a', 'd'])
  })
  it('preserves input order and enforces the per-section cap', () => {
    const events = [he('road_closure', '1'), he('road_closure', '2'), he('road_closure', '3')]
    const out = groupHistoryBySection(events, 2)
    expect(out[0].events.map(e => e.event.id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Run to verify fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
// append to lib/local/history.ts
export function groupHistoryBySection(events: HistoryEvent[], perSectionLimit: number): HistorySectionView[] {
  const buckets = new Map<string, HistoryEvent[]>()
  for (const e of events) {
    const key = sectionForType(e.specEventType)
    if (!key) continue
    const list = buckets.get(key) ?? []
    if (list.length < perSectionLimit) list.push(e)
    buckets.set(key, list)
  }
  return HISTORY_SECTIONS
    .map(def => ({ def, events: buckets.get(def.key) ?? [] }))
    .filter(s => s.events.length > 0)
}
```

- [ ] **Step 4: Run + commit** — PASS. Then:

```bash
git add lib/local/history.ts lib/local/history.test.ts
git commit -m "feat(local): groupHistoryBySection"
```

---

## Task 12: readEventHistory (I/O reader)

**Files:** Modify `lib/local/history.ts`

I/O wrapper — no unit test (matches the ingestion-code convention); validated by `tsc` + build + the page rendering. Runs per-section queries in parallel, batched joins, and the routine partition/summary for Roads.

- [ ] **Step 1: Implement `readEventHistory`**

Append to `lib/local/history.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { mapStoredEventToLocalEvent, readSourcesByEvent, type StoredEventRow } from './store-read'

interface HistoryRow extends StoredEventRow {
  event_type: string
  first_detected_at: string | null
  resolved_at: string | null
  verification_status: string | null
  latest_update_at: string
  first_seen_at: string
}

const SELECT_COLS =
  'id, title, headline, event_type, status, first_seen_at, first_detected_at, latest_update_at, resolved_at, verification_status, geo, consequence_score, confidence, summary, why_it_matters, what_changed, importance, last_seen_at'

const ROADS_FETCH_LIMIT = 500 // fetch the 30-day road window, then partition routine vs not in code

async function fetchSection(sb: SupabaseClient, eventTypes: string[], sinceIso: string, limit: number): Promise<HistoryRow[]> {
  const { data, error } = await sb
    .from('local_events')
    .select(SELECT_COLS)
    .eq('publish_state', 'published')
    .in('lifecycle_state', ['resolved', 'archived'])
    .in('event_type', eventTypes)
    .gte('resolved_at', sinceIso) // resolved_at is set on every resolution (absence + sweep)
    .order('resolved_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`history ${eventTypes.join(',')}: ${error.message}`)
  return (data ?? []) as HistoryRow[]
}

async function resolutionReasons(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, string | null>> {
  const m = new Map<string, string | null>()
  if (eventIds.length === 0) return m
  const { data } = await sb
    .from('local_event_update')
    .select('event_id, at, new_value')
    .eq('kind', 'resolved')
    .in('event_id', eventIds)
    .order('at', { ascending: false })
  for (const r of (data ?? []) as Array<{ event_id: string; new_value: { reason?: string } | null }>) {
    if (!m.has(r.event_id)) m.set(r.event_id, r.new_value?.reason ?? null) // first = most recent
  }
  return m
}

async function correctionCounts(sb: SupabaseClient, eventIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (eventIds.length === 0) return m
  const { data } = await sb.from('local_event_update').select('event_id').eq('kind', 'correction').in('event_id', eventIds)
  for (const r of (data ?? []) as Array<{ event_id: string }>) m.set(r.event_id, (m.get(r.event_id) ?? 0) + 1)
  return m
}

function toHistoryEvent(
  row: HistoryRow,
  sources: Parameters<typeof mapStoredEventToLocalEvent>[1],
  reason: string | null | undefined,
  correctionCount: number,
): HistoryEvent {
  return {
    event: mapStoredEventToLocalEvent(row, sources),
    specEventType: row.event_type,
    startedAt: row.first_seen_at ?? undefined,     // source-provided start (see reconciliation note)
    firstDetectedAt: row.first_detected_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    latestUpdateAt: row.latest_update_at ?? undefined,
    resolutionKind: inferResolutionKind({ resolvedAt: row.resolved_at ?? undefined, latestUpdateAt: row.latest_update_at ?? undefined, reason }),
    correctionCount,
    verificationLabel: verificationLabel(row.verification_status),
  }
}

export interface EventHistory {
  sections: HistorySectionView[]
  routineSummary?: string
}

export async function readEventHistory(sb: SupabaseClient, opts: { sinceDays?: number; perSectionLimit?: number } = {}): Promise<EventHistory> {
  const sinceDays = opts.sinceDays ?? 30
  const perSectionLimit = opts.perSectionLimit ?? 15
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const now = new Date()

  const roadsDef = HISTORY_SECTIONS.find(s => s.key === 'roads')!
  const otherDefs = HISTORY_SECTIONS.filter(s => s.key !== 'roads')

  // One query per section in parallel (Roads pulls a wider window to partition).
  const [roadRows, ...otherRows] = await Promise.all([
    fetchSection(sb, roadsDef.eventTypes, sinceIso, ROADS_FETCH_LIMIT),
    ...otherDefs.map(d => fetchSection(sb, d.eventTypes, sinceIso, perSectionLimit)),
  ])

  // Partition roads: routine road_closures → summary; everything else → rows (capped).
  const routine: HistoryRow[] = []
  const roadRowsKept: HistoryRow[] = []
  for (const r of roadRows) {
    if (isRoutineClosure({ specEventType: r.event_type, title: r.headline ?? r.title, summary: r.summary ?? undefined, startedAt: r.first_seen_at ?? undefined, resolvedAt: r.resolved_at ?? undefined })) routine.push(r)
    else roadRowsKept.push(r)
  }
  const roadTop = topRoadsByFrequency(routine.map(r => extractRoadName(r.headline ?? r.title)))
  const routineSummary = formatRoutineSummary(routine.length, roadTop)

  // Assemble the flat row set (roads capped to perSectionLimit here; others already capped by query).
  const allRows: HistoryRow[] = [...roadRowsKept.slice(0, perSectionLimit), ...otherRows.flat()]
  const ids = allRows.map(r => r.id)
  const [sources, reasons, corrections] = await Promise.all([
    readSourcesByEvent(sb, ids),
    resolutionReasons(sb, ids),
    correctionCounts(sb, ids),
  ])

  const events = allRows.map(r => toHistoryEvent(r, sources.get(r.id) ?? [], reasons.get(r.id), corrections.get(r.id) ?? 0))
  void now // formatting happens in the page with the request-time `now`
  return { sections: groupHistoryBySection(events, perSectionLimit), routineSummary }
}

function topRoadsByFrequency(names: string[]): string[] {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 3)
}
```

Note on `StoredEventRow`: it currently has `last_seen_at?: string | null`. `HistoryRow extends StoredEventRow` and adds the extra columns. Ensure `StoredEventRow` in `store-read.ts` includes the fields `mapStoredEventToLocalEvent` reads; it does. `mapStoredEventToLocalEvent`'s second arg type is the `LocalEvidenceSource[]` it already accepts.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `StoredEventRow` doesn't structurally accept the added `HistoryRow` fields, extend the interface locally (do not change `mapStoredEventToLocalEvent`).

- [ ] **Step 3: Run the full history suite (pure tests still green)**

Run: `npx vitest run lib/local/history.test.ts`
Expected: PASS (all pure-function suites).

- [ ] **Step 4: Commit**

```bash
git add lib/local/history.ts
git commit -m "feat(local): readEventHistory reader (per-section queries + routine summary)"
```

---

## Task 13: The page + nav link

**Files:**
- Create: `app/local/history/page.tsx`
- Modify: `app/local/page.tsx` (add the History link to the owner-only `note`)

- [ ] **Step 1: Write the page**

Create `app/local/history/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { readEventHistory, formatActiveDuration, formatResolution, type EventHistory, type HistoryEvent } from '@/lib/local/history'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Local — History' }

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function Row({ e, now }: { e: HistoryEvent; now: Date }) {
  const url = e.event.sources.find(s => s.url)?.url
  const isReservoir = e.specEventType === 'reservoir_change'
  const duration = isReservoir
    ? undefined
    : formatActiveDuration(e.startedAt, e.resolutionKind === 'time_sweep' ? e.latestUpdateAt : e.resolvedAt, { atLeast: e.resolutionKind === 'time_sweep' })
  const resolution = isReservoir
    ? (e.resolvedAt ? formatResolutionDate(e.resolvedAt, now) : undefined)
    : formatResolution(e.resolutionKind, e.resolvedAt, e.latestUpdateAt, now)
  const meta = [duration, resolution].filter(Boolean).join(' · ')
  return (
    <div className="group block border-t border-[#EFF2F6] py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-[15px] font-semibold leading-snug text-foreground">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="group-hover:text-[#2563EB]">{e.event.title} <span aria-hidden className="text-muted-foreground">→</span></a> : e.event.title}
        {e.correctionCount > 0 && <span className="ml-2 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">Corrected</span>}
      </div>
      {meta && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{meta}</p>}
      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        <span>{e.verificationLabel}</span>
        {e.event.sources[0] && <span>· {e.event.sources[0].label}</span>}
      </div>
    </div>
  )
}

// reservoir_change is a moment: "{headline} · {date}".
function formatResolutionDate(iso: string, now: Date): string {
  // reuse the page's Pacific formatter via history helper (date form).
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(Date.parse(iso))
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let history: EventHistory | null = null
  let error: string | null = null
  try {
    history = await readEventHistory(serviceClient())
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load history.'
  }
  const now = new Date()

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">What has concluded around you in the last 30 days.</p>
        </div>
        {error && <p className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-red-700">{error}</p>}
        {history && history.sections.length === 0 && !error && (
          <p className="rounded-lg border border-[#EFF2F6] bg-[#FAFBFC] px-4 py-8 text-center text-sm text-muted-foreground">No recent history yet.</p>
        )}
        {history && history.sections.map(section => (
          <section key={section.def.key} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span aria-hidden className="text-base leading-none">{section.def.icon}</span>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: section.def.accent }}>{section.def.label}</h2>
            </div>
            <div className="rounded-lg border border-[#EFF2F6] bg-white px-4 py-2">
              {section.events.map(e => <Row key={e.event.id} e={e} now={now} />)}
            </div>
            {section.def.key === 'roads' && history!.routineSummary && (
              <p className="mt-2 text-[12px] text-muted-foreground">{history!.routineSummary}</p>
            )}
          </section>
        ))}
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Add the nav link on `/local`**

In `app/local/page.tsx`, find the owner-only `note` span containing the `Review queue →` and `Pipeline status →` links and add a third link:

```tsx
          <a href="/local/history" className="text-xs font-semibold text-[#2563EB] hover:underline">History →</a>
```

(Place it after the `Pipeline status →` anchor, inside the same `<span className="mt-2 inline-flex gap-3">`.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` (clean), then `npx next build`.
Expected: compiles; `/local/history` appears as a route (`ƒ /local/history`).

- [ ] **Step 4: Commit**

```bash
git add app/local/history/page.tsx app/local/page.tsx
git commit -m "feat(local): /local/history page + nav link"
```

---

## Task 14: Full verification + branch wrap

- [ ] **Step 1: Full local suite + build**

Run: `npx vitest run lib/local` (expect all pass, new history + resolution suites included) and `npx next build` (green, `errors: []`).

- [ ] **Step 2: Push the branch and open the PR**

```bash
rtk proxy git push -u origin local-event-history
rtk proxy gh pr create --title "Local: event history (/local/history)" --body "<summary of the sections, reconciliations, tests>"
```

---

## Self-review checklist (completed by plan author)

- **Spec coverage:** §2 scope → Task 12 query filters. §3.1 per-section queries → Task 12 `fetchSection` in parallel. §3.2 batched joins → Task 12 `readSourcesByEvent`/`resolutionReasons`/`correctionCounts`. §3.3 routine summary → Task 12 partition + `topRoadsByFrequency` + Task 10. §4 durations/wording → Tasks 4–7. §5 routine predicate → Task 9; summary → Task 10; display → Task 13. §6 grouping/rows → Tasks 3, 11, 13 (verification label + Corrected badge + reservoir no-duration). §7 files → Tasks 1–3, 12, 13. §8 tests → Tasks 1,4–11 (resolver reason tested via pure `resolvedUpdateRow`, Task 1). §9 acceptance → per-section queries (Task 12) + routine summary + no numeric confidence (label only) + time_sweep "at least" wording.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `HistoryEvent`, `HistorySectionView`, `ResolutionKind` defined in Task 3 and used identically in Tasks 11–13; `readSourcesByEvent` (Task 2) consumed in Task 12; `resolvedUpdateRow`/`ResolutionReason` (Task 1) consumed by resolvers + reused as `ResolutionKind`.
- **Known reconciliation:** §4.1 duration start uses `first_seen_at` (documented in header); §4.2 `explicit_end` expiry heuristic intentionally not implemented (no stored expiry) — documented in Task 6.
