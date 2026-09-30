# Raw-payload Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bound `local_raw_payload` growth per the spec `docs/superpowers/specs/2026-09-30-raw-payload-retention-design.md` — skip identical payloads on write, and prune to 7-day-full + 90-day-daily-snapshot via a batched SQL function run each dispatch cycle, with retention/sweep health on `/local/status`.

**Architecture:** A Postgres function `local_prune_raw_payload` does the tiered delete in one batched statement (avoids a 5k-UUID `.in()`). `lib/local/ingest/retention.ts` wraps it (`retentionCutoff` pure + `pruneRawPayload` RPC). `archiveRawPayload` skips inserts whose body hash matches the source's latest archived row. The dispatcher runs the prune last (non-fatal) and records the prune + lifecycle sweep as labeled `local_job_run` rows shown on `/local/status`.

**Tech Stack:** Supabase Postgres (SQL function, RPC via supabase-js), Next.js 16 App Router, TypeScript, Vitest.

**Grounded facts (spec §0):** `local_raw_payload` has `source_id`, `body`, `created_at`, `content_hash`; `archiveRawPayload` already computes `hashContent([body])`. Nothing resolves `raw_ref` (§3.4 = no code). `local_job_run.source_id` is nullable. `/local/status` already renders `local_source?.slug ?? '—'`.

**Run tests:** `npx vitest run <path>` · **typecheck:** `npx tsc --noEmit` · **build:** `npx next build`. Migrations are applied MANUALLY in the Supabase SQL editor — Task 1's file is not executed by CI.

---

## Task 1: Migration — prune function + `label` column

**Files:**
- Create: `supabase/migrations/20260930_local_raw_payload_retention.sql`

- [ ] **Step 1: Write the migration**

```sql
-- My Local — raw-payload retention (spec 2026-09-30).
-- Adds the batched tiered-prune function + a nullable label on local_job_run so
-- the lifecycle sweep and the retention prune can be recorded/shown on /local/status.
-- Additive only. Apply in the Supabase SQL editor.

alter table local_job_run add column if not exists label text;

create or replace function public.local_prune_raw_payload(
  p_full_cutoff     timestamptz,  -- now - 7 days
  p_snapshot_cutoff timestamptz,  -- now - 90 days
  p_batch           integer
) returns integer
language sql
security invoker
as $$
  with candidates as (
    select id,
           created_at,
           row_number() over (
             partition by source_id,
                          (created_at at time zone 'America/Los_Angeles')::date
             order by created_at asc
           ) as day_rank
      from public.local_raw_payload
     where created_at < p_full_cutoff
  ),
  doomed as (
    select id
      from candidates
     where day_rank > 1                      -- not the daily snapshot
        or created_at < p_snapshot_cutoff    -- past the 90-day horizon
     order by created_at asc
     limit p_batch
  ),
  deleted as (
    delete from public.local_raw_payload r
     using doomed d
     where r.id = d.id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.local_prune_raw_payload(timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.local_prune_raw_payload(timestamptz, timestamptz, integer) to service_role;
```

- [ ] **Step 2: Sanity-check the SQL locally (syntax only)**

There is no local Postgres; verify by eye that (a) the column ALTER is `if not exists`, (b) the function keeps the daily snapshot (`day_rank = 1`) for rows in the 7–90 day band and deletes everything past 90 days, (c) `limit p_batch` bounds the delete. No command to run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260930_local_raw_payload_retention.sql
git commit -m "feat(local): raw-payload prune function + local_job_run.label (migration)"
```

---

## Task 2: `retentionCutoff` + constants (pure)

**Files:**
- Create: `lib/local/ingest/retention.ts`
- Test: `lib/local/ingest/retention.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/local/ingest/retention.test.ts
import { describe, expect, it } from 'vitest'
import { retentionCutoff } from './retention'

describe('retentionCutoff', () => {
  it('subtracts whole days in UTC', () => {
    expect(retentionCutoff(new Date('2026-09-30T12:00:00Z'), 7)).toBe('2026-09-23T12:00:00.000Z')
  })
  it('days=0 returns the same instant', () => {
    expect(retentionCutoff(new Date('2026-09-30T12:00:00Z'), 0)).toBe('2026-09-30T12:00:00.000Z')
  })
  it('is exact across a DST boundary (UTC arithmetic)', () => {
    // 2026 US DST ends Nov 1; 7 UTC days before Nov 10 12:00Z is exactly Nov 3 12:00Z.
    expect(retentionCutoff(new Date('2026-11-10T12:00:00Z'), 7)).toBe('2026-11-03T12:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/local/ingest/retention.test.ts`
Expected: FAIL (Cannot find module './retention').

- [ ] **Step 3: Implement**

```ts
// lib/local/ingest/retention.ts
// Raw-payload retention (spec 2026-09-30). Keep every payload for 7 days, then one
// per source per Pacific day up to 90 days; the SQL function does the delete. This
// module owns the cutoffs + the RPC wrapper. Pure retentionCutoff is tested; the
// RPC call is thin I/O.

export const RAW_PAYLOAD_FULL_DAYS = 7
export const RAW_PAYLOAD_SNAPSHOT_DAYS = 90
export const RAW_PAYLOAD_PRUNE_BATCH = 5000
export const RAW_PAYLOAD_PRUNE_TIMEOUT_MS = 5000

// ISO timestamp `days` before `now`, computed in UTC (exact days*24h, DST-independent).
export function retentionCutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/local/ingest/retention.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/local/ingest/retention.ts lib/local/ingest/retention.test.ts
git commit -m "feat(local): retentionCutoff + retention constants"
```

---

## Task 3: `pruneRawPayload` (RPC wrapper, I/O)

**Files:**
- Modify: `lib/local/ingest/retention.ts`

I/O — not unit-tested (repo convention). Verified by `tsc` + the dispatcher wiring.

- [ ] **Step 1: Add the imports + function**

At the top of `lib/local/ingest/retention.ts` add:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
```

Then append:

```ts
export interface PruneOptions {
  fullDays?: number
  snapshotDays?: number
  batchLimit?: number
  timeoutMs?: number
  now?: Date
}

// Runs the batched tiered delete via the local_prune_raw_payload SQL function.
// Time-boxed with an AbortSignal so it can't consume the dispatch time budget; the
// batch cap bounds the server-side work regardless. Returns rows deleted; throws on
// error or timeout (the dispatcher catches it).
export async function pruneRawPayload(sb: SupabaseClient, opts: PruneOptions = {}): Promise<number> {
  const now = opts.now ?? new Date()
  const fullCutoff = retentionCutoff(now, opts.fullDays ?? RAW_PAYLOAD_FULL_DAYS)
  const snapshotCutoff = retentionCutoff(now, opts.snapshotDays ?? RAW_PAYLOAD_SNAPSHOT_DAYS)
  const batch = opts.batchLimit ?? RAW_PAYLOAD_PRUNE_BATCH

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? RAW_PAYLOAD_PRUNE_TIMEOUT_MS)
  try {
    const { data, error } = await sb
      .rpc('local_prune_raw_payload', {
        p_full_cutoff: fullCutoff,
        p_snapshot_cutoff: snapshotCutoff,
        p_batch: batch,
      })
      .abortSignal(controller.signal)
    if (error) throw new Error(`pruneRawPayload: ${error.message}`)
    return typeof data === 'number' ? data : 0
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If `.abortSignal` isn't on the RPC builder type in this supabase-js version, drop the `.abortSignal(controller.signal)` chain and the controller/timer, keeping the plain `await sb.rpc(...)` — report this as a deviation.)

- [ ] **Step 3: Run the retention test (still green)**

Run: `npx vitest run lib/local/ingest/retention.test.ts`
Expected: PASS (3 tests — the pure function is unchanged).

- [ ] **Step 4: Commit**

```bash
git add lib/local/ingest/retention.ts
git commit -m "feat(local): pruneRawPayload RPC wrapper"
```

---

## Task 4: Skip identical payloads on write (§2.3)

**Files:**
- Modify: `lib/local/ingest/raw-archive.ts`
- Test: `lib/local/ingest/raw-archive.test.ts` (already exists)

`archiveRawPayload` currently always upserts. Change it to skip the insert when the
body hash matches the source's most recent archived row, returning that row's
`storage_key` so `raw_ref` still points at a real row. Extract the pure decision so
it's tested.

- [ ] **Step 1: Add a failing test for the pure decision**

Append to `lib/local/ingest/raw-archive.test.ts`:

```ts
import { shouldArchive } from './raw-archive'

describe('shouldArchive (§2.3 skip identical)', () => {
  it('skips when the new hash equals the latest archived hash', () => {
    expect(shouldArchive('abc', 'abc')).toBe(false)
  })
  it('archives when the hash differs or there is no prior row', () => {
    expect(shouldArchive('abc', 'def')).toBe(true)
    expect(shouldArchive(null, 'abc')).toBe(true)
    expect(shouldArchive(undefined, 'abc')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/local/ingest/raw-archive.test.ts`
Expected: FAIL (`shouldArchive` is not exported).

- [ ] **Step 3: Implement the helper + wire it in**

In `lib/local/ingest/raw-archive.ts` add the pure helper (near the top, after imports):

```ts
// §2.3: archive only when the body changed since this source's last archived payload.
export function shouldArchive(latestHash: string | null | undefined, currentHash: string): boolean {
  return latestHash !== currentHash
}
```

Then in `archiveRawPayload`, BEFORE the existing upsert (right after `const hash = hashContent([body])` and `const key = storageKey(...)`), read the source's latest hash and short-circuit:

```ts
  // Skip the write when nothing changed since the last archived payload for this
  // source; return the existing storage_key so source_item.raw_ref stays valid.
  const { data: latest } = await supabase
    .from('local_raw_payload')
    .select('storage_key, content_hash')
    .eq('source_id', source.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const latestRow = latest?.[0] as { storage_key: string; content_hash: string } | undefined
  if (latestRow && !shouldArchive(latestRow.content_hash, hash)) {
    return latestRow.storage_key
  }
```

Leave the existing upsert + `return key` as the else path. (If `archiveRawPayload`'s params name the source differently than `source.id`, use the actual field; it receives the source row with an `id`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/local/ingest/raw-archive.test.ts`
Expected: PASS (existing tests + the 2 new `shouldArchive` tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (clean). Then:

```bash
git add lib/local/ingest/raw-archive.ts lib/local/ingest/raw-archive.test.ts
git commit -m "feat(local): skip identical raw payloads on write (§2.3)"
```

---

## Task 5: Dispatcher — run prune + record labeled runs

**Files:**
- Modify: `app/api/local/dispatch/route.ts`

I/O + integration — verified by `tsc` + `next build`.

- [ ] **Step 1: Add imports**

Add near the other `@/lib/local/ingest` imports in `app/api/local/dispatch/route.ts`:

```ts
import { pruneRawPayload } from '@/lib/local/ingest/retention'
```

- [ ] **Step 2: Record the lifecycle sweep as a labeled run**

Find the existing lifecycle block (`let lifecycle ... try { lifecycle = await sweepLifecycle(supabase) } catch ...`). Replace it with a version that also records a `local_job_run` row:

```ts
  // §7.4 lifecycle sweep — once per dispatch, recorded as a labeled run for /local/status.
  const sweepStart = new Date().toISOString()
  let lifecycle: { resolved: number; archived: number } | { error: string }
  try {
    const r = await sweepLifecycle(supabase)
    lifecycle = r
    await supabase.from('local_job_run').insert({
      source_id: null, label: 'Lifecycle sweep', started_at: sweepStart, finished_at: new Date().toISOString(),
      status: 'ok', events_updated: r.resolved + r.archived,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    lifecycle = { error: msg }
    await supabase.from('local_job_run').insert({
      source_id: null, label: 'Lifecycle sweep', started_at: sweepStart, finished_at: new Date().toISOString(),
      status: 'error', error: msg,
    })
  }
```

- [ ] **Step 3: Add the retention prune as the LAST step, recorded**

Immediately after the lifecycle block and before the `return NextResponse.json(...)`:

```ts
  // Raw-payload retention — last step, non-fatal, recorded as a labeled run.
  const pruneStart = new Date().toISOString()
  let prunedRawPayloads: number | { error: string }
  try {
    const n = await pruneRawPayload(supabase)
    prunedRawPayloads = n
    await supabase.from('local_job_run').insert({
      source_id: null, label: 'Raw-payload retention', started_at: pruneStart, finished_at: new Date().toISOString(),
      status: 'ok', items_new: n,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    prunedRawPayloads = { error: msg }
    await supabase.from('local_job_run').insert({
      source_id: null, label: 'Raw-payload retention', started_at: pruneStart, finished_at: new Date().toISOString(),
      status: 'error', error: msg,
    })
  }
```

- [ ] **Step 4: Add both to the JSON response**

In the final `return NextResponse.json({ ... })`, add `prunedRawPayloads` alongside the existing `lifecycle` field:

```ts
    lifecycle,
    prunedRawPayloads,
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit` (clean), then `npx next build` (compiles; `ƒ /api/local/dispatch` present).

- [ ] **Step 6: Commit**

```bash
git add app/api/local/dispatch/route.ts
git commit -m "feat(local): run raw-payload prune + record labeled sweep/retention runs"
```

---

## Task 6: `/local/status` — show labeled sweep/retention runs

**Files:**
- Modify: `lib/local/status.ts`

`/local/status`'s Recent-runs already renders `local_source?.slug ?? '—'`. Add `label`
to the query and fall back to it, so sourceless runs show "Lifecycle sweep" /
"Raw-payload retention" instead of `—`. Page needs no change.

- [ ] **Step 1: Select `label` and fall back to it**

In `lib/local/status.ts`, in `readPipelineStatus`, change the `local_job_run` select to include `label`:

```ts
    .select('started_at, finished_at, status, items_fetched, items_new, events_created, events_updated, error, label, local_source(slug)')
```

Update the row mapper's type to include `label: string | null` on the joined shape, and change the `slug` line to fall back to the label:

```ts
    slug: r.local_source?.slug ?? r.label ?? '—',
```

(The `JobRunView` type already exposes `slug`; the label flows into it. No new field needed.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` (clean), then `npx next build` (compiles). `/local/status` will now show the labeled rows once the migration is applied.

- [ ] **Step 3: Run the status test if present**

Run: `npx vitest run lib/local/status.test.ts`
Expected: PASS (the change is to the query/mapping; `summarizeSource` tests are unaffected).

- [ ] **Step 4: Commit**

```bash
git add lib/local/status.ts
git commit -m "feat(local): show lifecycle/retention runs on /local/status via label"
```

---

## Task 7: Record the decisions

**Files:**
- Modify: `docs/local/DECISIONS.md`

- [ ] **Step 1: Append the retention decisions**

Add to `docs/local/DECISIONS.md` (append under the existing decisions; match its heading style):

```markdown
## Raw-payload retention (2026-09-30)

- **Retention window deviates from Phase-0/1 §5.3 (90-day full).** We keep every
  `local_raw_payload` for 7 days, then one per source per Pacific day up to 90 days,
  then nothing. The raw archive is debug/replay only; the daily snapshot preserves
  replayability at ~90 rows/source. Enforced by `local_prune_raw_payload`.
- **Skip identical payloads on write.** `archiveRawPayload` skips the insert when a
  source's body hash is unchanged from its last archived row (`content_hash` already
  existed). Pruning is the backstop.
- **`raw_ref` resolution.** Nothing resolves `raw_ref` today, so pruning strands no
  reader. Any FUTURE `raw_ref` resolver (a "view raw" link, a replay script) MUST
  treat a missing row as "raw payload expired" — ideally via a shared helper — rather
  than throw.
```

- [ ] **Step 2: Commit**

```bash
git add docs/local/DECISIONS.md
git commit -m "docs(local): record raw-payload retention decisions"
```

---

## Task 8: Full verification + PR

- [ ] **Step 1: Full suite + build**

Run: `npx vitest run lib/local` (all pass, incl. `retention.test.ts` + `raw-archive.test.ts`) and `npx next build` (green, `errors: []`).

- [ ] **Step 2: Push + open the PR**

```bash
rtk proxy git push -u origin local-raw-retention
```

Open the PR with a body summarizing the change AND the two operator steps: (a) apply `20260930_local_raw_payload_retention.sql` in the Supabase SQL editor BEFORE/at deploy (the dispatcher writes `label` and the status page selects it), and (b) run the §4 size query and paste results:

```sql
select source_id,
       count(*) as rows,
       pg_size_pretty(sum(pg_column_size(body))) as body_size,
       pg_size_pretty(avg(pg_column_size(body))::bigint) as avg_body
  from local_raw_payload
 group by source_id
 order by sum(pg_column_size(body)) desc;
```

Include the §6 acceptance checks (no >1 payload per source per Pacific day older than 7 days; none older than 90 days; retention runs visible on `/local/status`).

---

## Self-review

- **Spec coverage:** §2.1 tiering → Task 1 function. §2.2 execution (last step, batch, non-fatal, time-boxed) → Tasks 3+5. §2.3 skip-on-write → Task 4. §3.1 migration → Task 1. §3.2 retention.ts → Tasks 2+3. §3.3 dispatch + labeled runs + status → Tasks 5+6 (label column in Task 1). §3.4 no-op → Task 7 (DECISIONS note). §4 size query → Task 8 PR. §5 tests → Tasks 2, 4. §7 operational (migration, VACUUM guidance) → Task 8 PR body.
- **Placeholders:** none — every step has concrete code/commands.
- **Type consistency:** `retentionCutoff`, `pruneRawPayload`, `PruneOptions`, `shouldArchive` defined in Tasks 2–4 and used consistently in Task 5. `label` column (Task 1) written in Task 5, read in Task 6.
- **Ordering note:** Task 1's migration must be applied in Supabase before the Task 5/6 code runs against prod (dispatcher writes `label`, status selects it) — called out in Task 8. In dev without the migration, the labeled-run inserts fail but are caught (non-fatal); the status select of `label` would error until applied.
