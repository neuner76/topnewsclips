import { describe, expect, it, afterEach } from 'vitest'
import { getLatestDigest, getRecentDigests, getDigestByDate } from './digest'

// The service-role key is scoped to Production, so a Preview build runs without it.
// These read paths run at build time (prerendered pages) and must return empty
// rather than throwing "supabaseKey is required", which would fail the preview build.
describe('digest reads are build-safe when the service key is absent', () => {
  const orig = process.env.SUPABASE_SERVICE_ROLE_KEY
  afterEach(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = orig })

  it('returns empty (not a throw) with no SUPABASE_SERVICE_ROLE_KEY', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(getLatestDigest()).resolves.toBeNull()
    await expect(getRecentDigests(5)).resolves.toEqual([])
    await expect(getDigestByDate('2026-01-01')).resolves.toBeNull()
  })
})
