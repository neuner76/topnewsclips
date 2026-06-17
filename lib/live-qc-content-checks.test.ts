import { describe, expect, it } from 'vitest'
// The live verifier's content checks are framework-free .mjs; vitest imports it directly.
import { runContentChecks, extractCards } from '../scripts/live-qc-content-checks.mjs'

// Synthetic rendered-feed fragments reproducing real 2026-06-16/17 defects.
// Each is a permanent fixture (Section 8): assert on the check id, not wording.
function run(htmlBody: string) {
  const html = `<html><body>${htmlBody}</body></html>`
  const text = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return runContentChecks(html, text, '/feed')
}
const ids = (list: Array<{ id: string }>) => list.map(f => f.id)

describe('live QC content checks (Section 2)', () => {
  it('hard-fails on an inconsistent coverage denominator ("of 14" + "of 15")', () => {
    const { failures } = run('Story A · 13 of 14 outlets. Story B · 0 of 15 outlets.')
    expect(ids(failures)).toContain('denominator_consistency')
  })

  it('hard-fails an 11-of-14 story placed under Global Blindspot', () => {
    const { failures } = run('Global Blindspot Provincial vote dispute 11 of 15 outlets Reported')
    expect(ids(failures)).toContain('blindspot_placement')
  })

  it('hard-fails a high-salience 0-of-N card (mass-casualty)', () => {
    const { failures } = run('Need To Know Gunman opens fire, 10 wounded 0 of 15 outlets Reported')
    expect(ids(failures)).toContain('high_severity_suspect_coverage')
  })

  it('warns on a duplication artifact ("aBC")', () => {
    const { warnings } = run('Need To Know Story 5 of 15 outlets ABC News Australia aBC Australia')
    expect(ids(warnings)).toContain('duplication_artifact')
  })

  it('warns on a source/attribution mismatch (two distinct outlets in one window)', () => {
    const { warnings } = run('Global Lens ABC News Australia segment relabeled africanews 3 of 15 outlets')
    expect(ids(warnings)).toContain('source_attribution_match')
  })

  it('hard-fails a commentary/analysis lead', () => {
    const { failures } = run('Need To Know Why the deal may not hold 6 of 15 outlets Analysis')
    expect(ids(failures)).toContain('lead_eligibility')
  })

  it('passes a clean edition with a consistent denominator', () => {
    const { failures } = run('Need To Know Court ruling sets deadline 9 of 15 outlets Corroborated. Politics 6 of 15 outlets Reported.')
    expect(failures).toHaveLength(0)
  })

  it('extractCards degrades gracefully on cardless HTML', () => {
    expect(extractCards('<html><body>nothing here</body></html>', '/feed')).toEqual([])
  })
})
