// A2: one-time QC backfill over all published stories.
//
// Default mode is report-only (dry run): every story is re-checked against
// the QC rubric and logged to qc_sweep_log, but nothing in `stories` changes.
//
// Pass --apply to actually write: high-confidence FIX cases (C1/C2) get the
// revised headline/summary applied, everything else (HOLD or low-confidence
// FIX) is unpublished and routed to the existing /admin/qc-holds queue.
//
// Usage:
//   npx tsx scripts/qc-backfill.ts            # report only
//   npx tsx scripts/qc-backfill.ts --apply    # apply auto-fixes + holds

import { createClient } from '@supabase/supabase-js'
import { runQCSweep } from '../lib/ingest/qc-sweep'

const apply = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

runQCSweep({
  supabase,
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  sinceDays: null,
  dryRun: !apply,
  source: 'backfill',
})
  .then(result => {
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (report only)'}`)
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
