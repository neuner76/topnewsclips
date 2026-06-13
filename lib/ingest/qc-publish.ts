import type { SupabaseClient } from '@supabase/supabase-js'
import { runQCGate, runStaticQCChecks, type QCCheckResult, type QCContentType, type QCConfidenceLabel } from './qc-gate'

export interface QCContext {
  section: string
  contentType: QCContentType
  confidenceLabel: QCConfidenceLabel
  sourceName: string
  sourceTier: number | null
  coverageCount: number
  rawSourceDescription: string
  videoPublishDate?: string | null
  eventDateEstimate?: string | null
}

export interface QCPublishResult {
  inserted: boolean
  held: boolean
  error?: string
  duplicate?: boolean
}

function isDuplicateStorySlug(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' && (error.message ?? '').includes('stories_slug_key')
}

// Trust-critical checks: a residual failure on any of these always holds.
// C0 = gate error, C1 = promo/junk leak, C2 = unnamed principal,
// C4 = freshness dishonesty, C6 = overstated confidence label.
// The rest (C3 precision, C5 attribution, C7 alignment, C8 tone) are
// copy-quality checks — worth revising, never worth keeping real news
// off the site.
const TRUST_CRITICAL_CHECKS = new Set(['C0', 'C1', 'C2', 'C4', 'C6'])
const STATIC_HOLD_CHECKS = new Set(['C1', 'C4', 'C6'])

function onlyCopyQualityFails(failedChecks: { id: string }[]): boolean {
  return failedChecks.length > 0 && failedChecks.every(c => !TRUST_CRITICAL_CHECKS.has(c.id))
}

function staticHoldFailures(checks: QCCheckResult[]): QCCheckResult[] {
  return checks.filter(check => check.result === 'fail' && STATIC_HOLD_CHECKS.has(check.id))
}

// Runs the pre-publish QC gate on a story payload, applies at most one
// automated revision (FIX), and inserts the result into `stories`.
// PASS -> publish as-is (or with the FIX revision applied).
// Residual copy-quality fails (C3/C5/C7/C8) after the revision cycle ->
// publish the best revision anyway, keeping the fails on record.
// Residual trust-critical fails (C1/C2/C4/C6) -> insert unpublished for
// human review.
export async function runQCAndInsert(
  supabase: SupabaseClient,
  anthropicKey: string,
  storyData: Record<string, unknown> & { slug: string; title: string; description: string },
  qc: QCContext
): Promise<QCPublishResult> {
  let headline = storyData.title
  let summary = storyData.description
  const staticFailures = staticHoldFailures(runStaticQCChecks({
    storyId: storyData.slug,
    section: qc.section,
    contentType: qc.contentType,
    confidenceLabel: qc.confidenceLabel,
    headline,
    summary,
    sourceName: qc.sourceName,
    sourceTier: qc.sourceTier,
    videoPublishDate: qc.videoPublishDate ?? null,
    eventDateEstimate: qc.eventDateEstimate ?? null,
    coverageCount: qc.coverageCount,
    rawSourceDescription: qc.rawSourceDescription,
  }))

  if (staticFailures.length > 0) {
    await supabase.from('qc_log').insert({
      story_slug: storyData.slug,
      verdict: 'HOLD',
      failed_checks: staticFailures,
      revision_applied: false,
      raw_result: {
        storyId: storyData.slug,
        verdict: 'HOLD',
        checks: staticFailures,
        revisedHeadline: null,
        revisedSummary: null,
        routingNote: 'Static QC hold before model gate.',
      },
    })

    const { error } = await supabase.from('stories').insert({
      ...storyData,
      title: headline,
      description: summary,
      published: false,
      display_order: 99,
      qc_status: 'hold',
      qc_failed_checks: staticFailures,
      qc_routing_note: 'Static QC hold before model gate.',
    })
    if (isDuplicateStorySlug(error)) return { inserted: false, held: false, duplicate: true }
    return { inserted: !error, held: true, error: error?.message }
  }

  const MAX_ATTEMPTS = 2 // initial pass + at most 1 revise-and-recheck cycle

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await runQCGate(
      {
        storyId: storyData.slug,
        section: qc.section,
        contentType: qc.contentType,
        confidenceLabel: qc.confidenceLabel,
        headline,
        summary,
        sourceName: qc.sourceName,
        sourceTier: qc.sourceTier,
        videoPublishDate: qc.videoPublishDate ?? null,
        eventDateEstimate: qc.eventDateEstimate ?? null,
        coverageCount: qc.coverageCount,
        rawSourceDescription: qc.rawSourceDescription,
        isRevision: attempt > 0,
      },
      anthropicKey
    )

    const failedChecks = result.checks.filter(c => c.result === 'fail')

    await supabase.from('qc_log').insert({
      story_slug: storyData.slug,
      verdict: result.verdict,
      failed_checks: failedChecks,
      revision_applied: attempt > 0,
      raw_result: result,
    })

    if (result.verdict === 'PASS') {
      const { error } = await supabase.from('stories').insert({
        ...storyData,
        title: headline,
        description: summary,
        qc_status: 'pass',
        qc_failed_checks: null,
        qc_routing_note: result.routingNote,
      })
      if (isDuplicateStorySlug(error)) return { inserted: false, held: false, duplicate: true }
      return { inserted: !error, held: false, error: error?.message }
    }

    if (result.verdict === 'FIX' && attempt < MAX_ATTEMPTS - 1 && (result.revisedHeadline || result.revisedSummary)) {
      headline = result.revisedHeadline ?? headline
      summary = result.revisedSummary ?? summary
      continue
    }

    // Out of revision attempts. If every residual failure is copy-quality,
    // publish the best available copy rather than holding — a lingering
    // style nit on the gate's own revision must not starve the digest.
    if (onlyCopyQualityFails(failedChecks)) {
      headline = result.revisedHeadline ?? headline
      summary = result.revisedSummary ?? summary
      const { error } = await supabase.from('stories').insert({
        ...storyData,
        title: headline,
        description: summary,
        qc_status: 'pass',
        qc_failed_checks: failedChecks,
        qc_routing_note: result.routingNote,
      })
      if (isDuplicateStorySlug(error)) return { inserted: false, held: false, duplicate: true }
      return { inserted: !error, held: false, error: error?.message }
    }

    // Residual trust-critical failure (or gate error) — never auto-publish
    const { error } = await supabase.from('stories').insert({
      ...storyData,
      title: headline,
      description: summary,
      published: false,
      display_order: 99,
      qc_status: 'hold',
      qc_failed_checks: failedChecks,
      qc_routing_note: result.routingNote,
    })
    if (isDuplicateStorySlug(error)) return { inserted: false, held: false, duplicate: true }
    return { inserted: !error, held: true, error: error?.message }
  }

  return { inserted: false, held: true, error: 'QC gate loop exhausted' }
}
