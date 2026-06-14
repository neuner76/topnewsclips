import { createClient } from '@supabase/supabase-js'
import { buildDigestEdition, canonicalItemIds, validateDigestEdition } from '../lib/digest-canonical'
import { normalizeDigestContent, type DigestContent, type Digest } from '../lib/digest'
import {
  buildCanonicalDigestFromStoryPool,
  pullScoreDistribution,
  validateCanonicalPull,
} from '../lib/digest-assembly'
import { DIGEST_INCLUSION_THRESHOLD } from '../lib/digest-pull-score'
import type { Story } from '../lib/types'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function digestSlugs(content: DigestContent): string[] {
  return [
    ...content.needToKnow.map(item => item.slug),
    ...Object.values(content.inTheKnow).flatMap(items => items.map(item => item.slug).filter(Boolean) as string[]),
    ...(content.etcetera ?? []).map(item => typeof item === 'string' ? null : item.slug).filter(Boolean) as string[],
    ...(content.globalBlindspots ?? []).map(item => item.slug),
    ...(content.globalLens ?? []).map(item => item.slug),
  ]
}

async function main() {
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  )
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.topnewsclips.com'

  const { data: digestRow, error: digestError } = await supabase
    .from('digests')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (digestError) throw digestError
  if (!digestRow) throw new Error('No digest found')

  const content = normalizeDigestContent(digestRow.content as Partial<DigestContent>)
  const slugs = [...new Set(digestSlugs(content))]
  const storyMap = new Map<string, Story>()

  if (slugs.length > 0) {
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select('*')
      .in('slug', slugs)
    if (storiesError) throw storiesError
    for (const story of (stories ?? []) as Story[]) storyMap.set(story.slug, story)
  }

  const digest: Digest = {
    id: digestRow.id,
    date: digestRow.date,
    content,
    generated_at: digestRow.generated_at,
  }
  const edition = buildDigestEdition(digest, storyMap, siteUrl)
  const result = validateDigestEdition(edition)

  console.log(`Digest ${edition.date}`)
  console.log(`Canonical items: ${canonicalItemIds(edition).length}`)

  if (result.warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of result.warnings) console.log(`- ${warning}`)
  }

  // ── Pull-quality calibration (Task 17) ────────────────────────────────────
  // Run the from-pool selection against the published story pool and print the
  // score distribution so the inclusion threshold can be calibrated against a
  // real day rather than assumed. Informational — does not fail the build yet,
  // since the from-pool selector is not wired into live generation.
  const { data: pool, error: poolError } = await supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(80)
  if (poolError) throw poolError
  reportPullQuality((pool ?? []) as Story[])

  if (result.errors.length > 0) {
    console.error('\nErrors:')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log('\nDigest validation passed.')
}

function reportPullQuality(stories: Story[]) {
  console.log(`\n=== Pull-quality calibration (from-pool selection over ${stories.length} published stories) ===`)
  if (stories.length === 0) {
    console.log('No published stories in pool — skipping.')
    return
  }

  const pull = buildCanonicalDigestFromStoryPool(stories)
  const placed = [
    ...pull.needToKnow,
    ...Object.values(pull.sections).flat(),
    ...pull.globalBlindspot,
  ]

  console.log(`\nSelected ${placed.length}, excluded ${pull.excluded.length}.`)
  console.log(`Need To Know (${pull.needToKnow.length}): ${pull.needToKnow.map(i => i.story.slug).join(', ') || '—'}`)
  for (const [section, items] of Object.entries(pull.sections)) {
    console.log(`${section} (${items.length}): ${items.map(i => `${i.story.slug}[${i.pull.pullScore}]`).join(', ')}`)
  }
  console.log(`Global Blindspot (${pull.globalBlindspot.length}): ${pull.globalBlindspot.map(i => i.story.slug).join(', ') || '—'}`)

  // Score distribution with the cut line marked.
  console.log(`\nScore distribution (cut line: score >= ${DIGEST_INCLUSION_THRESHOLD}):`)
  const dist = pullScoreDistribution(pull)
  const hist = new Map<number, { incl: number; excl: number }>()
  for (const row of dist) {
    const bucket = hist.get(row.score) ?? { incl: 0, excl: 0 }
    if (row.included) bucket.incl++
    else bucket.excl++
    hist.set(row.score, bucket)
  }
  const scores = [...hist.keys()].sort((a, b) => b - a)
  for (const score of scores) {
    const { incl, excl } = hist.get(score)!
    const marker = score === DIGEST_INCLUSION_THRESHOLD ? '  <-- threshold' : ''
    console.log(`  ${String(score).padStart(3)} | included ${'█'.repeat(incl)}${incl} | excluded ${'░'.repeat(excl)}${excl}${marker}`)
  }
  // Calibration warning: only meaningful for items the THRESHOLD dropped.
  // Items excluded for relational reasons (section cap, duplicate-of-lead) are
  // expected to sit at healthy scores, so they don't indicate a bad cut line.
  const relationalReason = (reason: string) => /at cap|duplicates Need To Know|bundled|state-affiliated|region label/.test(reason)
  const thresholdDropScores = new Set(
    pull.excluded.filter(e => !relationalReason(e.reason)).map(e => e.score)
  )
  const includedScores = new Set(dist.filter(r => r.included).map(r => r.score))
  const overlap = [...thresholdDropScores].filter(s => includedScores.has(s) && Math.abs(s - DIGEST_INCLUSION_THRESHOLD) <= 1)
  if (overlap.length > 0) {
    console.log(`\n⚠ Threshold-excluded and included items share scores ${overlap.join(', ')} near the cut — the threshold may not be discriminating. Tune DIGEST_PULL_WEIGHTS.`)
  } else {
    console.log('\n✓ Threshold cleanly separates threshold-excluded items from included ones (relational caps/dedup handle the rest).')
  }

  console.log('\nExcluded (high-interest) with reasons:')
  for (const ex of pull.excluded.slice(0, 20)) {
    console.log(`  - ${ex.story.slug} [${ex.score}] ${ex.role}: ${ex.reason}`)
  }

  const pullValidation = validateCanonicalPull(pull)
  if (pullValidation.warnings.length) {
    console.log('\nPull warnings:')
    for (const w of pullValidation.warnings) console.log(`  - ${w}`)
  }
  if (pullValidation.errors.length) {
    console.log('\nPull errors (would be critical once wired into live generation):')
    for (const e of pullValidation.errors) console.log(`  - ${e}`)
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') return JSON.stringify(error)
  return String(error)
}

main().catch(error => {
  console.error(`Digest validation failed: ${errorMessage(error)}`)
  process.exit(1)
})
