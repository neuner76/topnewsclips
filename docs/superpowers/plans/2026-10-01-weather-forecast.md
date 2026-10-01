# Current Weather + Short Forecast Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** Surface NWS current-period conditions + the next ~4 periods in the "Your Environment" section, per `docs/superpowers/specs/2026-10-01-weather-forecast-design.md`.

**Architecture:** Extend `normalizeNwsForecast` (pure) to also return `current` + `forecast` (keeping the existing top-level fields, which tests consume). Carry them through `SnapshotParts` → `EnvironmentSnapshot.weather` → `EnvironmentModule`. Live-path only; no DB/migration/ingestion.

**Tech Stack:** TypeScript, Next.js server component, Vitest.

**Grounded:** `NwsForecastRaw` period type must gain `name`/`temperatureUnit`/`isDaytime`. `temperatureF`/`shortForecast` are consumed by `environment.test.ts` + a `digest.test.ts` fixture → KEEP them, add alongside. `buildEnvironmentSnapshot` currently reads only `parts.forecast?.wind`.

---

## Task 1: Types — ForecastPeriod + extend snapshot

**Files:** Modify `lib/local/adapters/types.ts`

- [ ] **Step 1: Add `ForecastPeriod` + `weather` to `EnvironmentSnapshot`**

In `lib/local/adapters/types.ts`, add near `WindReading`:

```ts
export interface ForecastPeriod {
  name: string
  temperatureF?: number
  temperatureUnit?: string
  isDaytime?: boolean
  shortForecast?: string
}

export interface CurrentConditions {
  label: string
  temperatureF?: number
  temperatureUnit?: string
  shortForecast?: string
  isDaytime?: boolean
}
```

And add one optional field inside `EnvironmentSnapshot` (alongside `wind`):

```ts
  weather?: { current?: CurrentConditions; forecast: ForecastPeriod[] }
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (clean — unused types are fine). Then:

```bash
git add lib/local/adapters/types.ts
git commit -m "feat(local): ForecastPeriod/CurrentConditions types + EnvironmentSnapshot.weather"
```

---

## Task 2: Extend `normalizeNwsForecast`

**Files:** Modify `lib/local/adapters/nws.ts`; Create `lib/local/adapters/nws.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/local/adapters/nws.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeNwsForecast } from './nws'

const raw = {
  properties: {
    periods: [
      { name: 'This Afternoon', temperature: 68, temperatureUnit: 'F', isDaytime: true, windSpeed: '5 to 10 mph', windDirection: 'W', shortForecast: 'Sunny' },
      { name: 'Tonight', temperature: 52, temperatureUnit: 'F', isDaytime: false, windSpeed: '5 mph', shortForecast: 'Clear' },
      { name: 'Tuesday', temperature: 71, temperatureUnit: 'F', isDaytime: true, shortForecast: 'Sunny' },
      { name: 'Tuesday Night', temperature: 50, temperatureUnit: 'F', isDaytime: false, shortForecast: 'Clear' },
      { name: 'Wednesday', temperature: 73, temperatureUnit: 'F', isDaytime: true, shortForecast: 'Partly Sunny' },
      { name: 'Wednesday Night', temperature: 49, temperatureUnit: 'F', isDaytime: false, shortForecast: 'Clear' },
    ],
  },
}

describe('normalizeNwsForecast', () => {
  it('returns wind + top-level temp/sky (unchanged) + current + next 4 periods', () => {
    const r = normalizeNwsForecast(raw)
    expect(r.wind.speedMph).toBe(10)
    expect(r.temperatureF).toBe(68)       // existing field kept
    expect(r.shortForecast).toBe('Sunny') // existing field kept
    expect(r.current).toEqual({ label: 'This Afternoon', temperatureF: 68, temperatureUnit: 'F', shortForecast: 'Sunny', isDaytime: true })
    expect(r.forecast.map(p => p.name)).toEqual(['Tonight', 'Tuesday', 'Tuesday Night', 'Wednesday']) // periods 1..4
  })
  it('handles empty/missing periods: no current, empty forecast, wind still returned', () => {
    const r = normalizeNwsForecast({ properties: { periods: [] } })
    expect(r.current).toBeUndefined()
    expect(r.forecast).toEqual([])
    expect(r.wind).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/local/adapters/nws.test.ts`
Expected: FAIL (`current`/`forecast` undefined).

- [ ] **Step 3: Extend the raw period type + the function**

In `lib/local/adapters/nws.ts`:

(a) widen the `NwsForecastRaw` period shape to include the fields we now read:

```ts
interface NwsForecastRaw { properties?: { periods?: Array<{ name?: string; temperature?: number; temperatureUnit?: string; isDaytime?: boolean; windSpeed?: string; windDirection?: string; shortForecast?: string }> } }
```

(b) import the new types and rewrite the function (keep existing fields, add current + forecast):

```ts
import type { WindReading, FireRisk, NwsAlertSummary, QuakeSummary, CurrentConditions, ForecastPeriod } from './types'
// ^ add CurrentConditions, ForecastPeriod to the existing type import from './types'

export function normalizeNwsForecast(raw: NwsForecastRaw): {
  wind: WindReading
  temperatureF?: number
  shortForecast?: string
  current?: CurrentConditions
  forecast: ForecastPeriod[]
} {
  const periods = raw.properties?.periods ?? []
  const p = periods[0] ?? {}
  const current: CurrentConditions | undefined = periods.length > 0
    ? { label: p.name ?? 'Now', temperatureF: p.temperature, temperatureUnit: p.temperatureUnit, shortForecast: p.shortForecast, isDaytime: p.isDaytime }
    : undefined
  const forecast: ForecastPeriod[] = periods.slice(1, 5).map(q => ({
    name: q.name ?? '', temperatureF: q.temperature, temperatureUnit: q.temperatureUnit, isDaytime: q.isDaytime, shortForecast: q.shortForecast,
  }))
  return {
    wind: { text: p.windSpeed ?? '', speedMph: parseMph(p.windSpeed), direction: p.windDirection },
    temperatureF: p.temperature,
    shortForecast: p.shortForecast,
    current,
    forecast,
  }
}
```

(Only add the two names to the existing `import type { … } from './types'` line — don't duplicate the import. Match the actual existing import list in the file.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/local/adapters/nws.test.ts lib/local/adapters/environment.test.ts`
Expected: PASS (new nws tests + the existing environment.test still green — temperatureF/shortForecast unchanged).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (clean). Then:

```bash
git add lib/local/adapters/nws.ts lib/local/adapters/nws.test.ts
git commit -m "feat(local): normalizeNwsForecast returns current + short forecast"
```

---

## Task 3: Carry into the snapshot

**Files:** Modify `lib/local/digest.ts`

- [ ] **Step 1: Extend `SnapshotParts.forecast`**

In `lib/local/digest.ts`, update the `forecast?` field of `SnapshotParts` to include the new shapes (import `CurrentConditions`, `ForecastPeriod` from `./adapters/types` with the other type imports):

```ts
  forecast?: { wind: WindReading; temperatureF?: number; shortForecast?: string; current?: CurrentConditions; forecast?: ForecastPeriod[] }
```

- [ ] **Step 2: Populate `weather` in `buildEnvironmentSnapshot`**

Add to the object returned by `buildEnvironmentSnapshot` (after `wind: parts.forecast?.wind,`):

```ts
    weather: parts.forecast
      ? { current: parts.forecast.current, forecast: parts.forecast.forecast ?? [] }
      : undefined,
```

- [ ] **Step 3: Typecheck + run digest tests**

Run: `npx tsc --noEmit` (clean), then `npx vitest run lib/local/digest.test.ts` (PASS — the fixture's forecast lacks current/forecast, so `weather` = `{ current: undefined, forecast: [] }`, which is fine).

- [ ] **Step 4: Commit**

```bash
git add lib/local/digest.ts
git commit -m "feat(local): carry weather (current+forecast) into EnvironmentSnapshot"
```

---

## Task 4: Render in EnvironmentModule

**Files:** Modify `app/local/LocalDigestView.tsx`

- [ ] **Step 1: Add the current line + forecast strip**

In `EnvironmentModule`, immediately after the `<Eyebrow … />` line and BEFORE the `<div className="grid …">` stat grid, insert:

```tsx
      {env.weather?.current && (
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums text-foreground">
            {env.weather.current.temperatureF != null ? `${Math.round(env.weather.current.temperatureF)}°${env.weather.current.temperatureUnit ?? ''}` : '—'}
          </span>
          <span className="text-sm text-muted-foreground">
            {[env.weather.current.label, env.weather.current.shortForecast].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
      {env.weather && env.weather.forecast.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {env.weather.forecast.map((p, i) => (
            <div key={i} className="shrink-0 rounded-md bg-[#F1F5F9] px-2.5 py-1.5 text-center">
              <div className="text-[11px] font-semibold text-[#475569]">{p.name}</div>
              <div className="text-sm font-bold tabular-nums text-foreground">{p.temperatureF != null ? `${Math.round(p.temperatureF)}°` : '—'}</div>
              {p.shortForecast && <div className="mt-0.5 max-w-[7rem] truncate text-[10px] text-muted-foreground" title={p.shortForecast}>{p.shortForecast}</div>}
            </div>
          ))}
        </div>
      )}
```

(If `EnvironmentSnapshot` isn't already imported in this file, it is — `EnvironmentModule` is typed with it. No new import needed.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` (clean), then `npx next build` (compiles; `/local` renders). The overflow-x-auto strip must not cause horizontal page scroll — it scrolls within its own container.

- [ ] **Step 3: Commit**

```bash
git add app/local/LocalDigestView.tsx
git commit -m "feat(local): show current conditions + forecast strip in Environment"
```

---

## Task 5: Full verification + PR

- [ ] **Step 1:** `npx vitest run lib/local` (all pass) + `npx next build` (green).
- [ ] **Step 2:** `rtk proxy git push -u origin local-weather-forecast` and open the PR summarizing the change (live-path, no DB/migration; current = NWS forecast period, observed temp deferred).

---

## Self-review
- **Spec coverage:** §3.1 normalize → Task 2. §3.2 snapshot/types → Tasks 1,3. §4 UI → Task 4. §5 tests → Task 2. §2 "keep top-level fields" honored (consumed by existing tests). 
- **Placeholders:** none.
- **Type consistency:** `ForecastPeriod`/`CurrentConditions` defined in Task 1, used in Tasks 2–4; `weather` field defined Task 1, populated Task 3, read Task 4.
