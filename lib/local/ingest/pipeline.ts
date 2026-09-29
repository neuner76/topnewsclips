import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceAdapter } from './types'
import { archiveRawPayload } from './raw-archive'
import { landEventForItem, type EventTypeConfig } from './events'
import { resolveAbsentEvents } from './resolve'

// §5.2 pipeline: FETCH → ARCHIVE RAW → NORMALIZE → DEDUPE-UPSERT into
// local_source_item → (for incident/alert adapters) LAND EVENTS → (for current-state
// feeds) RESOLVE ABSENT. Idempotent: the unique (source_id, content_hash) +
// ignoreDuplicates means re-running the same payload inserts nothing new and lands
// no events. Event landing runs only for NEWLY-inserted items, so a re-fetch of
// unchanged content is a no-op; changed content is a new item → matched onto the
// active event (or a fresh one). Resolution (§7.4) uses the dedupe_keys seen across
// ALL items this run (new or duplicate), so an event still present isn't resolved.

export interface RunResult {
  slug: string
  itemsFetched: number
  itemsNew: number
  eventsCreated: number
  eventsUpdated: number
  eventsResolved: number
}

export interface RunOptions {
  eventTypes?: Map<string, EventTypeConfig>
}

export async function runSource(
  supabase: SupabaseClient,
  source: { id: string; slug: string; evidenceLevel: number },
  adapter: SourceAdapter,
  opts: RunOptions = {},
): Promise<RunResult> {
  let itemsFetched = 0
  let itemsNew = 0
  let eventsCreated = 0
  let eventsUpdated = 0
  let eventsResolved = 0

  // Every dedupe_key present in this fetch (new OR duplicate) — the input to §7.4
  // absence resolution below.
  const seenDedupeKeys = new Set<string>()

  const payloads = await adapter.fetch({ now: new Date() })
  for (const raw of payloads) {
    // ARCHIVE RAW (§5.3) before normalizing; the ref threads onto every item.
    const rawRef = await archiveRawPayload(supabase, source, raw)

    const items = await adapter.normalize(raw)
    itemsFetched += items.length

    for (const it of items) {
      // Candidates are computed for every item so their dedupe_keys count as "seen"
      // even when the item is a content-hash duplicate (not re-inserted).
      const candidates = adapter.toEventCandidates ? adapter.toEventCandidates(it) : []
      for (const c of candidates) if (c.dedupeKey) seenDedupeKeys.add(c.dedupeKey)

      const row = {
        source_id: source.id,
        external_id: it.externalId ?? null,
        content_hash: it.contentHash,
        title: it.title ?? null,
        body_text: it.bodyText ?? null,
        url: it.url ?? null,
        raw_ref: rawRef,
        place_text: it.placeText ?? null,
        published_at: it.publishedAt ?? null,
        geo_precision: it.geo?.precision ?? null,
        extracted: it.extracted ?? {},
        fetched_at: raw.fetchedAt,
        processing_state: 'new',
      }

      // Upsert; ignoreDuplicates means .select returns the row only when it's new.
      const { data, error } = await supabase
        .from('local_source_item')
        .upsert(row, { onConflict: 'source_id,content_hash', ignoreDuplicates: true })
        .select('id')
      if (error) throw new Error(`local_source_item upsert: ${error.message}`)
      if (!data || data.length === 0) continue // duplicate — already processed
      itemsNew += 1
      const sourceItemId = data[0].id

      // LAND EVENTS — incident/alert adapters only, new items only.
      for (const candidate of candidates) {
        const outcome = await landEventForItem(
          supabase,
          { id: source.id, evidenceLevel: source.evidenceLevel },
          sourceItemId,
          candidate,
          opts.eventTypes?.get(candidate.eventType),
        )
        if (outcome === 'created') eventsCreated += 1
        else eventsUpdated += 1
      }
    }
  }

  // FRESHNESS — bump last_seen_at on every active event re-confirmed this run (its
  // dedupe_key appeared, changed or not), so the UI shows "confirmed Xm ago" rather
  // than "last changed 9h ago" for a still-current event.
  if (seenDedupeKeys.size > 0) {
    await supabase
      .from('local_events')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('lifecycle_state', 'active')
      .in('dedupe_key', [...seenDedupeKeys])
  }

  // RESOLVE ABSENT (§7.4) — only for current-state feeds, and only when the fetch
  // actually returned a payload (an empty payload list means we fetched nothing —
  // e.g. a source with no API key — so we must not resolve everything).
  if (adapter.resolvesByAbsence && payloads.length > 0) {
    eventsResolved = await resolveAbsentEvents(supabase, source.slug, seenDedupeKeys)
  }

  return { slug: source.slug, itemsFetched, itemsNew, eventsCreated, eventsUpdated, eventsResolved }
}
