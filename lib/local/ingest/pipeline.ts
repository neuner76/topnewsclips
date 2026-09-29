import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceAdapter } from './types'
import { archiveRawPayload } from './raw-archive'
import { landEventForItem, type EventTypeConfig } from './events'

// §5.2 pipeline: FETCH → ARCHIVE RAW → NORMALIZE → DEDUPE-UPSERT into
// local_source_item → (for incident/alert adapters) LAND EVENTS. Idempotent: the
// unique (source_id, content_hash) + ignoreDuplicates means re-running the same
// payload inserts nothing new and lands no events. Event landing runs only for
// NEWLY-inserted items, so a re-fetch of unchanged content is a no-op; changed
// content is a new item → matched onto the active event (or a fresh one).

export interface RunResult {
  slug: string
  itemsFetched: number
  itemsNew: number
  eventsCreated: number
  eventsUpdated: number
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

  const payloads = await adapter.fetch({ now: new Date() })
  for (const raw of payloads) {
    // ARCHIVE RAW (§5.3) before normalizing; the ref threads onto every item.
    const rawRef = await archiveRawPayload(supabase, source, raw)

    const items = await adapter.normalize(raw)
    itemsFetched += items.length

    for (const it of items) {
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

      // LAND EVENTS — incident/alert adapters only.
      if (adapter.toEventCandidates) {
        for (const candidate of adapter.toEventCandidates(it)) {
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
  }

  return { slug: source.slug, itemsFetched, itemsNew, eventsCreated, eventsUpdated }
}
