import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceAdapter } from './types'

// Phase-0 slice of the §5.2 pipeline: FETCH → NORMALIZE → DEDUPE-UPSERT into
// local_source_item. (GEOLOCATE / OBSERVATIONS / EVENT creation / VERIFY / SCORE /
// PUBLISH land next, once the event columns + gazetteer are in.) Idempotent: the
// unique (source_id, content_hash) + ignoreDuplicates means re-running the same
// payload inserts nothing new.

export interface RunResult {
  slug: string
  itemsFetched: number
  itemsNew: number
}

export async function runSource(
  supabase: SupabaseClient,
  source: { id: string; slug: string },
  adapter: SourceAdapter,
): Promise<RunResult> {
  let itemsFetched = 0
  let itemsNew = 0

  const payloads = await adapter.fetch({ now: new Date() })
  for (const raw of payloads) {
    const items = await adapter.normalize(raw)
    itemsFetched += items.length
    if (items.length === 0) continue

    const rows = items.map(it => ({
      source_id: source.id,
      external_id: it.externalId ?? null,
      content_hash: it.contentHash,
      title: it.title ?? null,
      body_text: it.bodyText ?? null,
      url: it.url ?? null,
      place_text: it.placeText ?? null,
      published_at: it.publishedAt ?? null,
      geo_precision: it.geo?.precision ?? null,
      extracted: it.extracted ?? {},
      fetched_at: raw.fetchedAt,
      processing_state: 'new',
    }))

    // Upsert; ignoreDuplicates means .select returns only the newly-inserted rows.
    const { data, error } = await supabase
      .from('local_source_item')
      .upsert(rows, { onConflict: 'source_id,content_hash', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`local_source_item upsert: ${error.message}`)
    itemsNew += data?.length ?? 0
  }

  return { slug: source.slug, itemsFetched, itemsNew }
}
