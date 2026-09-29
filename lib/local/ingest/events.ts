import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventCandidate, GeoPrecision } from './types'
import { deriveVerificationStatus, computeConfidence } from './trust'
import { computeImportance } from './importance'
import { decidePublish } from './publish'

// §7.2/§7.3 — turn an EventCandidate into a local_events row: match an active event
// by dedupe_key (append an update) or create a new one, then attach the origin
// event_source and a timeline event_update. Trust / importance / publish come from
// the pure §4/§9/§10 functions. Called from the pipeline for NEWLY-inserted items.

// The subset of local_event_type config the landing step needs (§3.9).
export interface EventTypeConfig {
  slug: string
  autoPublish: boolean
  autoPublishMinEvidenceLevel?: number | null
  minGeoPrecision?: GeoPrecision | null
  baseImportance: number
  requiredFields: string[]
}

export async function loadEventTypes(supabase: SupabaseClient): Promise<Map<string, EventTypeConfig>> {
  const { data, error } = await supabase
    .from('local_event_type')
    .select('slug, auto_publish, auto_publish_min_evidence_level, min_geo_precision, base_importance, required_fields')
  if (error) throw new Error(`load event types: ${error.message}`)
  const m = new Map<string, EventTypeConfig>()
  for (const r of data ?? []) {
    m.set(r.slug, {
      slug: r.slug,
      autoPublish: !!r.auto_publish,
      autoPublishMinEvidenceLevel: r.auto_publish_min_evidence_level,
      minGeoPrecision: r.min_geo_precision,
      baseImportance: r.base_importance ?? 0,
      requiredFields: r.required_fields ?? [],
    })
  }
  return m
}

// §10 required-field gate for the fields we can decide from the candidate alone.
// (The one-event_source requirement is always met — we attach the origin below.)
export function hasRequiredFields(
  candidate: EventCandidate,
  geoPrecision: GeoPrecision,
  extraRequired: string[] = [],
): boolean {
  if (!candidate.headline) return false
  if (!candidate.eventType) return false
  if (!candidate.startedAt) return false
  if (geoPrecision === 'unknown') return false // no place_id/geom yet → not mappable
  const f = candidate.fields ?? {}
  return extraRequired.every(k => f[k] != null && f[k] !== '')
}

function confidenceLabel(num: number): 'high' | 'medium' | 'low' {
  return num >= 0.8 ? 'high' : num >= 0.5 ? 'medium' : 'low'
}

export type LandOutcome = 'created' | 'updated'

export async function landEventForItem(
  supabase: SupabaseClient,
  source: { id: string; evidenceLevel: number },
  sourceItemId: string,
  candidate: EventCandidate,
  etype: EventTypeConfig | undefined,
): Promise<LandOutcome> {
  const now = new Date().toISOString()
  const geoPrecision: GeoPrecision = candidate.geo?.precision ?? 'unknown'
  const dedupeKey = candidate.dedupeKey ?? null

  // MATCH — an active event with the same dedupe_key (§7.3). Append an update +
  // corroborating source; the partial-unique index guarantees at most one.
  if (dedupeKey) {
    const { data: existing, error: matchErr } = await supabase
      .from('local_events')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .eq('lifecycle_state', 'active')
      .limit(1)
    if (matchErr) throw new Error(`match event: ${matchErr.message}`)
    if (existing && existing.length > 0) {
      const eventId = existing[0].id
      await supabase.from('local_event_source').upsert(
        { event_id: eventId, source_item_id: sourceItemId, role: candidate.sourceRole ?? 'update', is_independent: true },
        { onConflict: 'event_id,source_item_id', ignoreDuplicates: true },
      )
      await supabase.from('local_event_update').insert({
        event_id: eventId, kind: 'detail', text: candidate.headline ?? null, source_item_id: sourceItemId,
      })
      await supabase.from('local_events').update({ latest_update_at: now, updated_at: now }).eq('id', eventId)
      return 'updated'
    }
  }

  // CREATE — verification / confidence / importance / publish from the pure funcs.
  const levels = [source.evidenceLevel]
  const verification = deriveVerificationStatus(levels)
  const confidenceNum = computeConfidence(levels, geoPrecision)
  const importance = computeImportance({
    baseImportance: etype?.baseImportance ?? 0,
    eventType: candidate.eventType,
    fields: candidate.fields,
    startedAt: candidate.startedAt,
  })
  const publish = decidePublish({
    eventType: candidate.eventType,
    autoPublish: etype?.autoPublish ?? false,
    autoPublishMinEvidenceLevel: etype?.autoPublishMinEvidenceLevel,
    minGeoPrecision: etype?.minGeoPrecision,
    geoPrecision,
    attachedEvidenceLevels: levels,
    hasRequiredFields: hasRequiredFields(candidate, geoPrecision, etype?.requiredFields ?? []),
    textValid: true, // template headline (event name) is deterministic (§7.5)
  })

  const { data: created, error: insErr } = await supabase
    .from('local_events')
    .insert({
      title: candidate.headline ?? candidate.eventType,
      headline: candidate.headline ?? null,
      event_type: candidate.eventType,
      status: 'new',
      lifecycle_state: 'active',
      verification_status: verification,
      confidence: confidenceLabel(confidenceNum),
      confidence_num: confidenceNum,
      importance,
      consequence_score: importance / 100,
      first_seen_at: candidate.startedAt ?? now,
      first_detected_at: now,
      latest_update_at: now,
      geo_precision: geoPrecision,
      summary: candidate.summary ?? null,
      dedupe_key: dedupeKey,
      publish_state: publish.state,
      publish_reason: publish.reason,
    })
    .select('id')
  if (insErr) throw new Error(`create event: ${insErr.message}`)
  const eventId = created![0].id

  await supabase.from('local_event_source').insert({
    event_id: eventId, source_item_id: sourceItemId, role: candidate.sourceRole ?? 'origin', is_independent: true,
  })
  await supabase.from('local_event_update').insert({
    event_id: eventId, kind: 'detected', text: candidate.headline ?? null, source_item_id: sourceItemId,
  })
  return 'created'
}
