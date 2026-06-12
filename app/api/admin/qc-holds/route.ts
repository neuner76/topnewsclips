import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/auth'
import { runQCGate, type QCContentType, type QCConfidenceLabel } from '@/lib/ingest/qc-gate'
import { getConfidenceLabel, CONFIDENCE_META } from '@/lib/confidence'
import type { Story } from '@/lib/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function contentTypeForCategory(category: Story['category']): QCContentType {
  if (category === 'analysis') return 'analysis'
  if (category === 'comedy') return 'satire'
  return 'reported'
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { id, action, title, description } = await request.json()
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  if (action !== 'publish' && action !== 'discard' && action !== 'recheck') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = getSupabase()

  if (action === 'recheck') {
    const { data: story, error: fetchErr } = await supabase
      .from('stories')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const coverageCount = story.msm_outlet_coverage?.covered?.length ?? 0
    // null label = comedy/satire (no confidence label) — QC under 'Satire'
    const rawLabel = getConfidenceLabel(story as Story)
    const confidenceLabel = (rawLabel ? CONFIDENCE_META[rawLabel].label : 'Satire') as QCConfidenceLabel

    const result = await runQCGate(
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
      process.env.ANTHROPIC_API_KEY!
    )

    const failedChecks = result.checks.filter(c => c.result === 'fail')

    await supabase.from('qc_log').insert({
      story_slug: story.slug,
      verdict: result.verdict,
      failed_checks: failedChecks,
      revision_applied: result.verdict === 'FIX',
      raw_result: result,
    })

    if (result.verdict === 'PASS' || result.verdict === 'FIX') {
      const update: Record<string, unknown> = {
        published: true,
        display_order: 50,
        qc_status: 'pass',
        qc_failed_checks: null,
        qc_routing_note: result.routingNote,
        updated_at: new Date().toISOString(),
      }
      if (result.revisedHeadline) update.title = result.revisedHeadline
      if (result.revisedSummary) update.description = result.revisedSummary

      const { error } = await supabase.from('stories').update(update).eq('id', id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, verdict: result.verdict })
    }

    // Still HOLD — refresh the routing note / failed checks for the editor
    const { error } = await supabase
      .from('stories')
      .update({
        qc_failed_checks: failedChecks,
        qc_routing_note: result.routingNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, verdict: result.verdict })
  }

  if (action === 'discard') {
    const { data: story, error: fetchErr } = await supabase
      .from('stories')
      .select('slug')
      .eq('id', id)
      .single()

    if (fetchErr || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    await supabase.from('rejected_slugs').upsert({ slug: story.slug, reason: 'qc_hold_discarded' })
    const { error: deleteErr } = await supabase.from('stories').delete().eq('id', id)
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // action === 'publish' — manual editorial override after fixing the held content
  const update: Record<string, unknown> = {
    published: true,
    display_order: 50,
    qc_status: 'pass',
    qc_failed_checks: null,
    updated_at: new Date().toISOString(),
  }
  if (typeof title === 'string' && title.trim()) update.title = title.trim()
  if (typeof description === 'string' && description.trim()) update.description = description.trim()

  const { error } = await supabase.from('stories').update(update).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
