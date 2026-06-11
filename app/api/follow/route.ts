import { NextRequest, NextResponse } from 'next/server'
import { follow, unfollow } from '@/lib/personalization'
import { verifyPreferenceToken } from '@/lib/preference-tokens'

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const subscriberId = token ? verifyPreferenceToken(token)?.subscriberId : null
  if (!subscriberId) {
    return NextResponse.json({ error: 'Invalid or expired preference link.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const taxonomyId = body?.taxonomyId
  const action = body?.action
  if (typeof taxonomyId !== 'string' || (action !== 'follow' && action !== 'unfollow')) {
    return NextResponse.json({ error: 'Invalid follow payload.' }, { status: 400 })
  }

  if (action === 'follow') {
    await follow(subscriberId, taxonomyId)
  } else {
    await unfollow(subscriberId, taxonomyId)
  }

  return NextResponse.json({ ok: true })
}
