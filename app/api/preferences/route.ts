import { NextRequest, NextResponse } from 'next/server'
import { verifyPreferenceToken } from '@/lib/preference-tokens'
import { getPreferences, resetPersonalization, upsertPreferences } from '@/lib/personalization'
import type { FormatPreference, PreferencePayload } from '@/lib/personalization-types'
import { getActiveTaxonomy, getStoryVolumeByTaxonomy } from '@/lib/taxonomy'
import { normalizeKeywordList } from '@/lib/keyword-preferences'

const FORMATS = new Set<FormatPreference>(['digest', 'clips', 'both'])

function subscriberFromRequest(req: NextRequest): string | null {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return null
  return verifyPreferenceToken(token)?.subscriberId ?? null
}

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
}

function cleanKeywords(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) return []
  return normalizeKeywordList(keywords.filter((keyword): keyword is string => typeof keyword === 'string'))
}

export async function GET(req: NextRequest) {
  const subscriberId = subscriberFromRequest(req)
  if (!subscriberId) {
    return NextResponse.json({ error: 'Invalid or expired preference link.' }, { status: 401 })
  }

  const taxonomy = await getActiveTaxonomy()
  const [preferences, volumes] = await Promise.all([
    getPreferences(subscriberId, taxonomy),
    getStoryVolumeByTaxonomy(),
  ])

  return NextResponse.json({ taxonomy, preferences, volumes })
}

export async function POST(req: NextRequest) {
  const subscriberId = subscriberFromRequest(req)
  if (!subscriberId) {
    return NextResponse.json({ error: 'Invalid or expired preference link.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid preference payload.' }, { status: 400 })
  }

  if (body.reset === true) {
    await resetPersonalization(subscriberId)
    return NextResponse.json({ ok: true, reset: true })
  }

  const payload: PreferencePayload = {
    formatPreference: FORMATS.has(body.formatPreference) ? body.formatPreference : 'both',
    pacePreference: 'full',
    topicIds: cleanIds(body.topicIds),
    regionIds: cleanIds(body.regionIds),
    sectionIds: cleanIds(body.sectionIds),
    keywords: cleanKeywords(body.keywords),
  }

  await upsertPreferences(subscriberId, payload)
  return NextResponse.json({ ok: true })
}
