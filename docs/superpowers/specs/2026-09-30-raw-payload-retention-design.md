# Raw-payload retention

**Status:** approved design (2026-09-30)
**Depends on:** the ingestion pipeline (`local_raw_payload`, PR #98) + dispatcher.
**Schema:** no changes. Uses the existing `local_raw_payload_created_idx`.

## 1. Purpose

Bound the growth of `local_raw_payload`. The dispatcher archives one raw payload per
source per fetch (`archiveRawPayload`, before normalization), and the storage key
includes the per-fetch timestamp, so **every fetch writes a new full-body row** —
roughly 1,000 rows/day across the active sources, each holding the raw JSON/CSV/XML
body. The table only exists to replay/debug normalization; nothing user-facing reads
it. Left alone it grows without limit.

This is safe to prune: nothing has a foreign key to `local_raw_payload`
(`local_source_item.raw_ref` is a plain text pointer, not an FK), so deleting rows
cascades to nothing.

Scope decision: **raw_payload only.** `local_source_item` churn was already removed
in PR #116, so it now grows slowly; pruning it is deferred (it carries cascade risk
via `local_event_source` and isn't the growth driver). Out of scope below.

## 2. Behaviour

- Keep raw payloads for **7 days** (`RAW_PAYLOAD_RETENTION_DAYS = 7`). They exist
  only for short-term normalization forensics.
- Prune in **bounded batches** of up to **5,000 rows per run**
  (`RAW_PAYLOAD_PRUNE_BATCH = 5000`), oldest first. This caps the work of any single
  run — the initial backlog (whatever has accumulated) drains over a few cycles, and
  steady-state each run deletes only the handful of rows that just crossed 7 days.
- Runs **once per dispatch cycle** (~every 5 min), folded into the existing
  `/api/local/dispatch` — no new cron, no new function invocation.
- **Non-fatal:** a prune failure is caught and reported, never fails the dispatch or
  the ingest runs.

## 3. Components / files

### `lib/local/ingest/retention.ts` (new)
- `RAW_PAYLOAD_RETENTION_DAYS = 7`, `RAW_PAYLOAD_PRUNE_BATCH = 5000` — constants.
- `retentionCutoff(now: Date, days: number): string` — **pure, tested**. Returns the
  ISO timestamp `days` before `now` (the delete boundary).
- `pruneRawPayload(sb, opts?: { olderThanDays?: number; batchLimit?: number; now?: Date }): Promise<number>`
  — thin I/O. Computes the cutoff via `retentionCutoff`, selects up to `batchLimit`
  ids from `local_raw_payload` where `created_at < cutoff` ordered `created_at asc`
  (uses `local_raw_payload_created_idx`), then deletes them by id. Returns the number
  deleted. supabase-js has no delete-with-subquery, so this is a two-step
  select-then-delete; that is acceptable (the id select is small and indexed). Throws
  on a query error (the dispatcher catches it).

### `app/api/local/dispatch/route.ts` (modify)
- After the §7.4 lifecycle sweep, call `pruneRawPayload(supabase)` inside its own
  try/catch (mirroring the `lifecycle` block). Add the result to the JSON response as
  `prunedRawPayloads: number` (or `{ error }` on failure). A failure is logged into
  the response, not thrown.

## 4. Testing

- `retention.test.ts`:
  - `retentionCutoff(new Date('2026-09-30T12:00:00Z'), 7)` → `'2026-09-23T12:00:00.000Z'`.
  - `retentionCutoff` with `days = 0` → the same instant as `now`.
  - a non-7 window (e.g. 30) subtracts correctly.
- `pruneRawPayload` is thin I/O and is not unit-tested (matches the repo convention —
  pure logic tested, DB wrappers not).
- `npx tsc --noEmit` clean; full `npx vitest run lib/local` green; `npx next build`
  green.

## 5. Operational notes

- No new environment variable, cron, or migration.
- On first deploy the accumulated backlog drains at up to 5,000 rows/cycle; Postgres
  reclaims the freed space via Supabase's automatic autovacuum (gradual, no manual
  `VACUUM`, no billing impact).
- Cost: two extra indexed queries per dispatch cycle (negligible); net effect is a
  storage reduction, since Supabase bills on database size.

## 6. Out of scope (clean to add later)
- Pruning `local_source_item` (and/or nulling old `body_text`) — deferred; it grows
  slowly post-#116 and deletion cascades to `local_event_source` provenance, so it
  needs its own safety rule.
- Per-source or configurable-via-env retention windows.
- A retention/audit log table.
- Object-store backend for raw payloads (the migration's O3 note).
