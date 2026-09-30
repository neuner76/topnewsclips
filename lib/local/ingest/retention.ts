import type { SupabaseClient } from '@supabase/supabase-js'

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
