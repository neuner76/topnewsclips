import { unstable_cache } from 'next/cache'
import { buildMyLocalDigest, type LocalBuildContext, type MyLocalDigest } from './digest'

// /local is computed live from ~15 external APIs. Even parallelized that's a few
// seconds, and share links are public (many people hitting the same town). Cache
// each location's digest for 10 minutes so repeat loads are instant and we stop
// hammering the county/NWS APIs and the owner's keys. Freshness cost: a new
// alert can lag up to the TTL — acceptable for a local "briefing".
const CACHE_TTL_SECONDS = 600 // 10 min

// unstable_cache keys on the keyParts + the serialized call arguments, so each
// distinct ctx (a saved-place set, or a shared location) gets its own entry, and
// owner mode (ctx === undefined) shares one entry.
const cachedBuild = unstable_cache(
  async (ctx?: LocalBuildContext) => buildMyLocalDigest(ctx),
  ['my-local-digest'],
  { revalidate: CACHE_TTL_SECONDS, tags: ['my-local-digest'] },
)

export function buildMyLocalDigestCached(ctx?: LocalBuildContext): Promise<MyLocalDigest> {
  return cachedBuild(ctx)
}
