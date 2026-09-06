import { NextResponse } from 'next/server'
import { requireCronSecretOrAdminSession } from '@/lib/auth'
import { getLatestDigest } from '@/lib/digest'
import { needsDigestRecovery } from '@/lib/digest-watchdog'

// Read-only status for the digest watchdog (see .github/workflows/watchdog.yml):
// reports whether today's digest exists so a dropped scheduled ingest can be
// recovered. Today is computed in America/New_York to match getLatestDigest.
export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const latest = await getLatestDigest()
    const latestDigestDate = latest?.date ?? null
    return NextResponse.json({
      today,
      latestDigestDate,
      needsRecovery: needsDigestRecovery(latestDigestDate, today),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
