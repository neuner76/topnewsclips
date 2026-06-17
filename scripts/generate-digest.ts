import { generateAndStoreDigest } from '../lib/digest'

// Minimum-viable-digest floor (spec 1.8). QC trims, never cancels: the digest
// always sends on schedule. If the passing-card count falls below this floor we
// send WHAT PASSED and loudly flag that the edition was light — we never skip
// the send and never block it. Exit stays 0 so the send step still runs; a
// ::warning:: surfaces the light morning in the run (and feeds the failure
// notification once 1.3 lands).
const DIGEST_FLOOR = 6

generateAndStoreDigest()
  .then(digest => {
    const ntk = Array.isArray(digest.content.needToKnow) ? digest.content.needToKnow.length : 0
    const itk = Object.values(digest.content.inTheKnow ?? {})
      .reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
    const etc = Array.isArray(digest.content.etcetera) ? digest.content.etcetera.length : 0
    const gbs = Array.isArray(digest.content.globalBlindspots) ? digest.content.globalBlindspots.length : 0
    const total = ntk + itk + etc + gbs
    console.log(`✓ Digest generated for ${digest.date}`)
    console.log(`  NeedToKnow: ${ntk} | InTheKnow: ${itk} | Etcetera: ${etc} | GlobalBlindspot: ${gbs} | Total: ${total}`)
    if (total < DIGEST_FLOOR) {
      console.warn(`::warning::LIGHT DIGEST — only ${total} passing cards (floor ${DIGEST_FLOOR}). Sending what passed; the send is never skipped.`)
    }
    process.exit(0)
  })
  .catch(err => {
    console.error('✗ Digest generation failed:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(err.stack)
    process.exit(1)
  })
