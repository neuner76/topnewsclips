import type { SupabaseClient } from '@supabase/supabase-js'
import { runQCGate, type QCContentType, type QCConfidenceLabel, type QCCheckResult } from './qc-gate'
import { getConfidenceLabel, CONFIDENCE_META } from '@/lib/confidence'
import type { Story } from '@/lib/types'

export type QCSweepSource = 'backfill' | 'nightly_sweep'
export type QCSweepAction = 'none' | 'auto_fix' | 'hold'

export interface QCSweepOptions {
  supabase: SupabaseClient
  anthropicKey: string
  // Trailing window in days for the nightly sweep. Pass null for the
  // one-time backfill (every published story, regardless of age).
  sinceDays: number | null
  // When true, log what would happen but never write to `stories`.
  dryRun: boolean
  source: QCSweepSource
}

export interface QCSweepStoryResult {
  slug: string
  verdict: 'PASS' | 'FIX' | 'HOLD'
  action: QCSweepAction
  failedChecks: QCCheckResult[]
}

export interface QCSweepResult {
  scanned: number
  passed: number
  autoFixed: number
  held: number
  errors: string[]
  results: QCSweepStoryResult[]
}

function contentTypeForCategory(category: Story['category']): QCContentType {
  if (category === 'analysis') return 'analysis'
  if (category === 'comedy') return 'satire'
  return 'reported'
}

// A FIX is "high confidence" — safe to auto-apply without human review —
// when every failed check is fixable by rewriting the copy: C1 (promo/junk
// strip), C2 (named principal insertion), or a copy-quality check
// (C3 precision, C5 attribution, C7 alignment, C8 tone). C4 (freshness)
// and C6 (confidence label) can't be fixed by a rewrite, so they still
// unpublish the story for human review.
const COPY_FIXABLE_CHECKS = new Set(['C1', 'C2', 'C3', 'C5', 'C7', 'C8'])

export function isHighConfidenceFix(failedChecks: QCCheckResult[]): boolean {
  if (failedChecks.length === 0) return false
  return failedChecks.every(c => COPY_FIXABLE_CHECKS.has(c.id))
}

export async function runQCSweep(options: QCSweepOptions): Promise<QCSweepResult> {
  const { supabase, anthropicKey, sinceDays, dryRun, source } = options

  let query = supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (sinceDays !== null) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query
  const result: QCSweepResult = { scanned: 0, passed: 0, autoFixed: 0, held: 0, errors: [], results: [] }

  if (error) {
    result.errors.push(`Failed to load stories: ${error.message}`)
    return result
  }

  const stories = (data ?? []) as Story[]

  for (const story of stories) {
    result.scanned++

    const coverageCount = story.msm_outlet_coverage?.covered?.length ?? 0
    // getConfidenceLabel returns null for comedy (no confidence label on satire) —
    // for QC purposes those stories are evaluated under the 'Satire' label.
    const rawLabel = getConfidenceLabel(story)
    const confidenceLabel = (rawLabel ? CONFIDENCE_META[rawLabel].label : 'Satire') as QCConfidenceLabel

    const gate = await runQCGate(
      {
        storyId: story.slug,
        section: story.category ?? 'reported',
        contentType: contentTypeForCategory(story.category),
        confidenceLabel,
        headline: story.title,
        summary: story.description,
        sourceName: story.source ?? '',
        sourceTier: story.source_tier,
        videoPublishDate: null,
        eventDateEstimate: story.created_at ? story.created_at.slice(0, 10) : null,
        coverageCount,
        rawSourceDescription: story.description,
      },
      anthropicKey
    )

    const failedChecks = gate.checks.filter(c => c.result === 'fail')

    let action: QCSweepAction = 'none'
    if (gate.verdict === 'PASS') {
      action = 'none'
      result.passed++
    } else if (gate.verdict === 'FIX' && isHighConfidenceFix(failedChecks) && (gate.revisedHeadline || gate.revisedSummary)) {
      action = 'auto_fix'
      result.autoFixed++
    } else {
      action = 'hold'
      result.held++
    }

    result.results.push({ slug: story.slug, verdict: gate.verdict, action, failedChecks })

    if (!dryRun) {
      if (action === 'auto_fix') {
        const update: Record<string, unknown> = {
          qc_status: 'pass',
          qc_failed_checks: null,
          qc_routing_note: gate.routingNote,
          updated_at: new Date().toISOString(),
        }
        if (gate.revisedHeadline) update.title = gate.revisedHeadline
        if (gate.revisedSummary) update.description = gate.revisedSummary

        const { error: updateErr } = await supabase.from('stories').update(update).eq('id', story.id)
        if (updateErr) result.errors.push(`Failed to auto-fix ${story.slug}: ${updateErr.message}`)
      } else if (action === 'hold') {
        const { error: updateErr } = await supabase
          .from('stories')
          .update({
            published: false,
            qc_status: 'hold',
            qc_failed_checks: failedChecks,
            qc_routing_note: gate.routingNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', story.id)
        if (updateErr) result.errors.push(`Failed to hold ${story.slug}: ${updateErr.message}`)
      }
    }

    const { error: logErr } = await supabase.from('qc_sweep_log').insert({
      story_slug: story.slug,
      source,
      verdict: gate.verdict,
      failed_checks: failedChecks,
      action,
      dry_run: dryRun,
      routing_note: gate.routingNote,
    })
    if (logErr) result.errors.push(`Failed to log sweep result for ${story.slug}: ${logErr.message}`)
  }

  return result
}
