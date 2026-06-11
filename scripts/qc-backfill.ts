// A2: one-time QC backfill over published stories.
//
// Default mode is report-only (dry run): every story is re-checked against
// the QC rubric and logged to qc_sweep_log, but nothing in `stories` changes.
//
// Pass --apply to actually write: high-confidence FIX cases (C1/C2) get the
// revised headline/summary applied, everything else (HOLD or low-confidence
// FIX) is unpublished and routed to the existing /admin/qc-holds queue.
//
// Pass --days=N to limit the scan to stories published in the trailing N
// days (default: all published stories — note stories auto-unpublish after
// 7 days via the cleanup cron, so "all" is effectively <= 7 days anyway).
//
// Usage:
//   npx tsx scripts/qc-backfill.ts                # report only, all published
//   npx tsx scripts/qc-backfill.ts --days=2       # report only, last 2 days
//   npx tsx scripts/qc-backfill.ts --days=2 --apply

import { createClient } from '@supabase/supabase-js'
import { runQCSweep } from '../lib/ingest/qc-sweep'

const apply = process.argv.includes('--apply')
const daysArg = process.argv.find(arg => arg.startsWith('--days='))
const sinceDays = daysArg ? Number(daysArg.slice('--days='.length)) : null

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

runQCSweep({
  supabase,
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  sinceDays,
  dryRun: !apply,
  source: 'backfill',
})
  .then(result => {
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (report only)'}`)
    console.log(`Window: ${sinceDays === null ? 'all published stories' : `last ${sinceDays} day(s)`}`)
    console.log(`Scanned: ${result.scanned}`)
    console.log(`  PASS (no change): ${result.passed}`)
    console.log(`  Auto-fixed (C1/C2 high-confidence): ${result.autoFixed}`)
    console.log(`  Held for review: ${result.held}`)
    if (result.errors.length) {
      console.log(`Errors: ${result.errors.length}`)
      for (const err of result.errors) console.log(`  - ${err}`)
    }

    const flagged = result.results.filter(r => r.action !== 'none')
    if (flagged.length) {
      console.log('\nFlagged stories:')
      for (const r of flagged) {
        console.log(`  [${r.action}] ${r.slug} (${r.verdict}) — ${r.failedChecks.map(c => c.id).join(', ')}`)
      }
    }

    process.exit(0)
  })
  .catch(err => {
    console.error('QC backfill failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
