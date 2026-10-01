# Current weather + short forecast

**Status:** approved design (2026-10-01)
**Depends on:** the existing live Environment path (`buildLiveEnvironment`, `normalizeNwsForecast`). No new source, DB, or migration.

## 1. Purpose

Show current conditions and a short forecast in the "Your Environment" section of
`/local`. The NWS gridpoint forecast is **already fetched** (for wind), and
`normalizeNwsForecast` already pulls `temperatureF` + `shortForecast` from period 0 —
but the snapshot keeps only `wind` and drops the rest. This surfaces that data plus
the next few periods. There is no current temperature or forecast on the page today.

## 2. Scope decisions

- **Current + short forecast.** Current conditions (period 0) plus the next ~4 NWS
  periods. Not a 7-day/weather-app view.
- **In the Environment section.** Enhance the existing "Your Environment" card; no
  new section. Weather stays unified with wind/AQI/tide/fire/alerts.
- **"Current" = the NWS forecast's current period** (temp + sky for "This
  Afternoon"/"Tonight"), already fetched — NOT an observed station reading. Observed
  live temp would need two extra NWS calls (nearest station → latest observation);
  deferred (out of scope §7). Labeling uses the period name, so it reads honestly as
  the current-period forecast, not a false "right now" claim.
- **Live-path only.** Environment is a live snapshot, not store-backed. No DB,
  migration, ingestion adapter, or config flag.

## 3. Data

`buildLiveEnvironment` already fetches the NWS forecast JSON and passes it through
`normalizeNwsForecast`. Extend that function (pure) to also return current + periods.

### 3.1 `normalizeNwsForecast` return shape (extended)

```ts
{
  wind: WindReading,            // unchanged
  current?: {
    label: string,              // period.name, e.g. "This Afternoon", "Tonight"
    temperatureF?: number,      // period.temperature (assumed °F; unit carried below)
    temperatureUnit?: string,   // period.temperatureUnit, e.g. "F"
    shortForecast?: string,     // e.g. "Sunny"
    isDaytime?: boolean,
  },
  forecast: ForecastPeriod[],   // the next up-to-4 periods AFTER period 0
}
```

Where `ForecastPeriod = { name: string; temperatureF?: number; temperatureUnit?: string; isDaytime?: boolean; shortForecast?: string }`.

- `current` is built from `periods[0]`; undefined if there are no periods.
- `forecast` is `periods.slice(1, 5)` mapped to `ForecastPeriod` (so ~2 days ahead).
- Fold the existing top-level `temperatureF`/`shortForecast` into `current` and
  update `buildEnvironmentSnapshot` to read `current`. The plan first greps to
  confirm `buildEnvironmentSnapshot` is the only consumer of those fields; if any
  other caller exists, keep the top-level fields too. (Expected: it's the only one.)

### 3.2 `EnvironmentSnapshot` (extended)

Add one optional field (in `lib/local/adapters/types.ts`):

```ts
weather?: {
  current?: { label: string; temperatureF?: number; temperatureUnit?: string; shortForecast?: string; isDaytime?: boolean }
  forecast: ForecastPeriod[]
}
```

`buildEnvironmentSnapshot` populates `weather` from `parts.forecast.current` +
`parts.forecast.forecast`. All other snapshot fields unchanged. `ForecastPeriod` is
exported from `adapters/types.ts` (shared by the normalizer and the snapshot).

## 4. UI

In `EnvironmentModule` (`app/local/LocalDigestView.tsx`), above the existing stat grid:

- **Current line** (when `env.weather?.current` present): prominent, e.g.
  `{label} · {temperatureF}°{unit} · {shortForecast}` → "This Afternoon · 68°F · Sunny".
  Omit any missing piece gracefully.
- **Forecast strip** (when `env.weather?.forecast` non-empty): a compact horizontal
  row of up to 4 period chips, each `{name} · {temp}° · {shortForecast}`. Wraps/
  scrolls on narrow screens (no horizontal page scroll). Styled consistently with the
  existing `Stat` treatment/accents; no new color system.
- The existing Wind/AQI/tide/fire/alerts stats render unchanged below.
- Source link: reuse the existing NWS link (`env.sources.wind` / the forecast page).
- If `env.weather` is absent (forecast fetch failed — `buildLiveEnvironment` already
  wraps each reading in `safe()`), render nothing new; the rest of Environment is
  unaffected.

## 5. Testing

- `nws.test.ts` (or the existing NWS adapter test): `normalizeNwsForecast` against a
  fixture with ≥5 periods →
  - `current` = period 0 (label, temperatureF, unit, shortForecast, isDaytime).
  - `forecast` = next 4 periods (periods 1–4), in order.
  - `wind` unchanged.
  - empty/missing `periods` → `current` undefined, `forecast` = `[]`, `wind` still returned.
- `npx tsc --noEmit` clean; full `npx vitest run lib/local` green; `npx next build`
  green. The UI render is not unit-tested (repo convention).

## 6. Acceptance

- `/local` → "Your Environment" shows a current line (period label + temp + sky) and
  a strip of the next ~4 periods, above the existing readings.
- When the NWS forecast fetch fails, Environment renders exactly as before (no empty
  weather block, no error).
- No numeric change to any other section; no DB/migration/env/config change.

## 7. Out of scope (clean to add later)
- Observed "right now" temperature via the station-observations endpoint (2 extra
  NWS calls + nearest-station resolution).
- 7-day / hourly forecast.
- Weather icons/glyphs beyond text (the shortForecast string).
- A dedicated "Weather" section separate from Environment.
- Any store-backing (weather is a live snapshot, not an event).
