# Raw-payload retention

**Status:** approved design, revised (2026-09-30)
**Depends on:** the ingestion pipeline (`local_raw_payload`, PR #98) and the dispatcher.
**Schema:** additive only. One migration adds the `local_prune_raw_payload` SQL function (§3.1) **and** a nullable `label text` column on `local_job_run` (§3.3, per the resolved decision below). No table drops or type changes. Uses the existing `local_raw_payload_created_idx`.

## 0. Reconciliations (grounded against the repo, 2026-09-30)

Facts confirmed by reading the code; they resolve this spec's conditionals:

- **§2.3 applies (not conditional).** `local_raw_payload.content_hash` exists and
  `archiveRawPayload` already computes and stores `hashContent([body])`. So the
  skip-identical-payloads-on-write optimization **is in scope** and is implemented,
  not deferred.
- **Column names confirmed** for §3.1/§4: `source_id`, `body`, `created_at`,
  `content_hash` all exist on `local_raw_payload`.
- **§3.4 is a no-op today.** Nothing reads `raw_ref` — it is written in
  `pipeline.ts` and returned by `raw-archive.ts`, but no "view raw" link or replay
  path resolves it. There are no callers to harden; record the guard as future
  guidance in `DECISIONS.md` and add no code for it now.
- **§3.3 decision:** the lifecycle sweep is not currently recorded in
  `local_job_run` (only per-source runs are). To show sweep + retention health on
  `/local/status`, this change **adds a nullable `label text` column to
  `local_job_run`** and records both the lifecycle sweep and the retention prune as
  rows with `source_id = null` and a `label`. `/local/status` already tolerates a
  null source (renders `—`); it will show `label` when present.
- **§4 size query is operator-run.** The agent has no direct production DB access;
  the measurement is a manual pre-merge step (SQL goes in the PR checklist).

## 1. Purpose

This spec bounds the growth of `local_raw_payload`.

The dispatcher archives one raw payload per source on every fetch (`archiveRawPayload`, called before normalization), so every fetch writes a new row containing the full body. That comes to roughly 1,000 rows a day across the active sources, each holding a raw JSON, CSV or XML body. The table exists only so normalization can be replayed or debugged, and nothing user-facing reads it. Left alone, it grows without limit.

Pruning is safe because nothing has a foreign key to `local_raw_payload`. `local_source_item.raw_ref` is a plain text pointer, not a foreign key, so deletes cascade to nothing. The pointers do go stale, and §3.4 covers that.

**Deviation from the parent spec:** §5.3 of the Phase 0–1 spec says to keep raw payloads for 90 days. This spec keeps every payload for 7 days and keeps one payload per source per day for 90 days (§2). Record the change in `docs/local/DECISIONS.md`.

## 2. Behaviour

### 2.1 Retention rule

| age | kept |
|---|---|
| under 7 days | every payload |
| 7–90 days | the **first payload per source per Pacific calendar day** (the daily snapshot) |
| over 90 days | nothing |

The daily snapshot means a normalization bug found weeks later can still be replayed against a real payload from each affected day. It costs at most about 90 rows per source.

Constants in `lib/local/ingest/retention.ts`:
- `RAW_PAYLOAD_FULL_DAYS = 7`
- `RAW_PAYLOAD_SNAPSHOT_DAYS = 90`
- `RAW_PAYLOAD_PRUNE_BATCH = 5000`
- `RAW_PAYLOAD_PRUNE_TIMEOUT_MS = 5000`

### 2.2 Execution
- Pruning runs once per dispatch cycle, about every 5 minutes, as the **last** step of `/api/local/dispatch`, after the §7.4 lifecycle sweep. There is no new cron and no new function invocation.
- Each run deletes at most `RAW_PAYLOAD_PRUNE_BATCH` rows, oldest first, in a single database call (§3.1).
  - The accumulated backlog drains over the first few cycles.
  - In steady state, each run deletes only the handful of rows that just crossed a boundary.
- The call is time-boxed (§3.2) so it cannot consume the dispatch function's time budget.
- Pruning is non-fatal. A failure is caught, logged (§3.3) and never fails the dispatch or any ingest run.

### 2.3 Skip identical payloads on write
Many fetches return a body identical to the previous one. Reservoir data changes daily, NWS alerts can sit unchanged for hours, and closures change slowly.

`local_raw_payload.content_hash` already exists and `archiveRawPayload` already
computes `hashContent([body])` (§0), so change `archiveRawPayload` to:
- Before inserting, read that source's most recent archived `content_hash` — one
  indexed query ordered by `created_at desc`, limit 1 (scoped by `source_id`).
- If the hash matches, skip the insert (return the existing `storage_key` so the
  source_item's `raw_ref` still points at a real row).
- Normalization still runs on every fetch. Only the archive write is skipped.

This likely reduces growth more than pruning does, making pruning a backstop. It
composes with §2.1: a day whose payload never changes still keeps its first row,
which is exactly the daily snapshot.

## 3. Components and files

### 3.1 Migration: `local_prune_raw_payload` (new SQL function)

One function does the delete in a single statement, bounded by the batch size. It returns the number of rows removed.

This replaces a select-IDs-then-delete-by-ID approach, which would fail. supabase-js sends `.in('id', ids)` in the URL, and 5,000 UUIDs is roughly 185 KB, far past request-line limits.

```sql
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

- Replace `source_id` with the table's actual source column name if it differs.
- The window function only scans rows older than 7 days.
  - In steady state that is about 90 snapshots per source plus the rows that just crossed the boundary.
  - During the first drain it is the whole backlog, a one-time sort of IDs and timestamps that is well within normal limits.

### 3.2 `lib/local/ingest/retention.ts` (new)
- The constants listed in §2.1.
- `retentionCutoff(now: Date, days: number): string`. A pure, tested function that returns the ISO timestamp `days` before `now`.
- `pruneRawPayload(sb, opts?: { fullDays?: number; snapshotDays?: number; batchLimit?: number; timeoutMs?: number; now?: Date }): Promise<number>`. A thin I/O wrapper:
  - It computes both cutoffs with `retentionCutoff`.
  - It calls `sb.rpc('local_prune_raw_payload', …)` with `.abortSignal()` set to a `timeoutMs` timer.
  - It returns the count, and throws on error or timeout.
  - The abort frees the dispatch function. It may not cancel the query server-side, but the batch cap bounds that work anyway.

### 3.3 `app/api/local/dispatch/route.ts` (modify)
- As the last step, after the lifecycle sweep, call `pruneRawPayload(supabase)` inside its own try/catch, mirroring the lifecycle block.
- Add `prunedRawPayloads: number`, or `{ error }` on failure, to the JSON response.
- **Record each prune run** (and the lifecycle sweep) in `local_job_run` so
  `/local/status` shows retention health next to source health. Per §0, the sweep is
  not recorded today and `local_job_run` has no discriminator, so this change:
  - Adds a nullable `label text` column to `local_job_run` (in the §3.1 migration).
  - Records the retention prune as a row: `source_id = null`, `label = 'raw-payload
    retention'`, `items_new` = rows deleted, `started_at`/`finished_at` set,
    `status = 'ok'|'error'`, `error` on failure.
  - Records the lifecycle sweep the same way: `label = 'lifecycle sweep'`,
    `events_updated`/`items_new` carrying its resolved/archived counts.
  - `/local/status` renders these: when `local_source` is null, show the `label`
    (falling back to the existing `—`). Add them to the Recent-runs table; the
    Sources table is unchanged.

### 3.4 Stale `raw_ref` pointers
After pruning, `local_source_item.raw_ref` will often point at deleted rows.
**Grounding (§0) found no code that resolves `raw_ref`** — it is write-only today
(set in `pipeline.ts`, returned by `raw-archive.ts`), with no "view raw" link or
replay path. So there is **nothing to harden in this change**; record in
`DECISIONS.md` that any future `raw_ref` resolver must treat a missing row as "raw
payload expired" (ideally via a shared helper) rather than throw. No code here.

## 4. Before merging: measure size

Row count is not the real driver; body size is. Run this against production and paste the result into the PR description:

```sql
select source_id,
       count(*)                                        as rows,
       pg_size_pretty(sum(pg_column_size(body)))       as body_size,
       pg_size_pretty(avg(pg_column_size(body))::bigint) as avg_body
  from local_raw_payload
 group by source_id
 order by sum(pg_column_size(body)) desc;
```

(Use the table's actual body column name.)

**Decision checkpoint:** if a single source accounts for more than half of total size, note it in `DECISIONS.md`. The likely next step is a shorter full-retention window for that source (out of scope here, see §7). The 7-day default still ships.

## 5. Testing

`retention.test.ts`:
- `retentionCutoff(new Date('2026-09-30T12:00:00Z'), 7)` returns `'2026-09-23T12:00:00.000Z'`.
- `retentionCutoff` with `days = 0` returns the same instant as `now`.
- `retentionCutoff` with 90 days subtracts correctly across the November DST change. Because the arithmetic is UTC, the result is exactly 90 × 24 hours earlier.

If §3.4 changes a shared `raw_ref` resolver helper, add a test that a missing row returns the expired state instead of throwing.

`pruneRawPayload`, the SQL function and the dispatch wiring are I/O and are not unit-tested, matching the repo convention that pure logic is tested and DB wrappers are not. Verify them manually with §6.

Also required: `npx tsc --noEmit` is clean, the full `npx vitest run lib/local` suite passes, and `npx next build` succeeds.

## 6. Acceptance (manual checks after deploy)

- Within an hour of deploy, `/local/status` shows retention runs with nonzero deletes while the backlog drains.
- Once the backlog has drained, no source has more than one payload on any Pacific day older than 7 days:
  ```sql
  select source_id, (created_at at time zone 'America/Los_Angeles')::date as day, count(*)
    from local_raw_payload
   where created_at < now() - interval '7 days'
   group by 1, 2
  having count(*) > 1;
  ```
  This returns zero rows.
- No payload is older than 90 days.
- Every payload from the last 7 days is present. Compare the per-source row count for the last 7 days against dispatch run counts; the counts will differ only if §2.3 skipping is active.
- A dispatch run with the database briefly unreachable during the prune still completes its ingests and reports the prune error.
- Opening an old source item's raw link shows "raw payload expired".

## 7. Operational notes

- **No new environment variables or crons.** There is one migration (§3.1), which adds a function and changes no tables.
- **Disk space.** Deleting rows stops the table from growing, because Postgres reuses the freed space for new rows. It does **not** shrink the database, and Supabase doesn't shrink disk on its own.
  - If §4 shows a large backlog (roughly over 1 GB), run `VACUUM FULL public.local_raw_payload;` once, from the Supabase SQL editor, after `/local/status` shows the backlog fully drained.
  - `VACUUM FULL` locks the table while it runs. The table will be small by then, so the lock is brief, but run it between dispatch cycles. Archive writes during the lock will wait rather than fail.
- **Cost.** One RPC call per dispatch cycle. With §2.3 active, add one small indexed read per fetch.

## 8. Out of scope (clean to add later)

- Per-source retention windows, including a shorter window for any source flagged in §4.
- Pruning `local_source_item` or nulling old `body_text`. It grows slowly since #116, and deletes there cascade to `local_event_source` provenance, so it needs its own safety rule.
- Moving raw payloads to an object store (the migration's O3 note).
- A separate retention audit table. The run records in §3.3 cover this.
