import type { SupabaseClient } from '@supabase/supabase-js'
import { runQCGate, type QCContentType, type QCConfidenceLabel } from './qc-gate'

export interface QCContext {
  section: string
  contentType: QCContentType
  confidenceLabel: QCConfidenceLabel
  sourceName: string
  sourceTier: number | null
  coverageCount: number
  rawSourceDescription: string
  videoPublishDate?: string | null
}

export interface QCPublishResult {
  inserted: boolean
  held: boolean
  error?: string
}

// Runs the pre-publish QC gate on a story payload, applies at most one
// automated revision (FIX), and inserts the result into `stories`.
// PASS -> publish as-is (or with the FIX revision applied).
// HOLD (or a second consecutive non-PASS) -> insert unpublished for human review.
export async function runQCAndInsert(
  supabase: SupabaseClient,
  anthropicKey: string,
  storyData: Record<string, unknown> & { slug: string; title: string; description: string },
  qc: QCContext
): Promise<QCPublishResult> {
  let headline = storyData.title
  let summary = storyData.description

  for (let attempt = 0; attempt < 2; attempt++) {
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
        coverageCount: qc.coverageCount,
        rawSourceDescription: qc.rawSourceDescription,
      },
      anthropicKey
    )

    const failedChecks = result.checks.filter(c => c.result === 'fail')

    await supabase.from('qc_log').insert({
      story_slug: storyData.slug,
      verdict: result.verdict,
      failed_checks: failedChecks,
      revision_applied: attempt === 1,
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
      return { inserted: !error, held: false, error: error?.message }
    }

    if (result.verdict === 'FIX' && attempt === 0 && (result.revisedHeadline || result.revisedSummary)) {
      headline = result.revisedHeadline ?? headline
      summary = result.revisedSummary ?? summary
      continue
    }

    // HOLD, or an unfixable/repeat FIX — never auto-publish
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
    return { inserted: !error, held: true, error: error?.message }
  }

  return { inserted: false, held: true, error: 'QC gate loop exhausted' }
}
