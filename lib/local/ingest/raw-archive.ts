import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawPayload } from './types'
import { hashContent } from './content-hash'

// §2.3: archive only when the body changed since this source's last archived payload.
export function shouldArchive(latestHash: string | null | undefined, currentHash: string): boolean {
  return latestHash !== currentHash
}

// Raw-payload archive (§5.3). Every fetch is archived so normalization can be
// replayed/debugged; the source_item's raw_ref points to the storage_key.

// Serialize a raw body to text for storage (JSON stringified; strings verbatim).
export function serializeRawBody(body: unknown): string {
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body)
  } catch {
    return String(body)
  }
}

// §5.3 key: source_slug/YYYY/MM/DD/<fetched_at>-<hash>.
export function storageKey(slug: string, fetchedAtIso: string, hash: string): string {
  const d = new Date(fetchedAtIso)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${slug}/${yyyy}/${mm}/${dd}/${fetchedAtIso}-${hash}`
}

// Archive one raw payload; returns its storage_key (→ source_item.raw_ref).
export async function archiveRawPayload(
  supabase: SupabaseClient,
  source: { id: string; slug: string },
  raw: RawPayload,
): Promise<string> {
  const body = serializeRawBody(raw.body)
  const hash = hashContent([body])
  const key = storageKey(source.slug, raw.fetchedAt, hash)

  // Skip the write when nothing changed since the last archived payload for this
  // source; return the existing storage_key so source_item.raw_ref stays valid.
  const { data: latest } = await supabase
    .from('local_raw_payload')
    .select('storage_key, content_hash')
    .eq('source_id', source.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const latestRow = latest?.[0] as { storage_key: string; content_hash: string } | undefined
  if (latestRow && !shouldArchive(latestRow.content_hash, hash)) {
    return latestRow.storage_key
  }
  const { error } = await supabase
    .from('local_raw_payload')
    .upsert(
      {
        source_id: source.id,
        source_slug: source.slug,
        storage_key: key,
        content_hash: hash,
        content_type: raw.contentType ?? null,
        url: raw.url ?? null,
        fetched_at: raw.fetchedAt,
        body,
        byte_size: body.length,
      },
      { onConflict: 'storage_key', ignoreDuplicates: true },
    )
  if (error) throw new Error(`local_raw_payload archive: ${error.message}`)
  return key
}
