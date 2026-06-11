import { createAdminClient } from '@/lib/supabase/admin'
import type {
  FormatPreference,
  PacePreference,
  PreferencePayload,
  SubscriberPreferences,
  TaxonomyItem,
} from '@/lib/personalization-types'

const DEFAULT_FORMAT: FormatPreference = 'both'
const DEFAULT_PACE: PacePreference = 'full'
const MAX_KEYWORDS = 12

function splitFollows(taxonomy: TaxonomyItem[], followedIds: string[]) {
  const byId = new Map(taxonomy.map(item => [item.id, item]))
  return {
    topicIds: followedIds.filter(id => byId.get(id)?.kind === 'topic'),
    regionIds: followedIds.filter(id => byId.get(id)?.kind === 'region'),
    sectionIds: followedIds.filter(id => byId.get(id)?.kind === 'section'),
  }
}

export async function getPreferences(subscriberId: string, taxonomy: TaxonomyItem[]): Promise<SubscriberPreferences> {
  const supabase = createAdminClient()
  const [{ data: pref, error: prefError }, { data: follows, error: followsError }, { data: keywords, error: keywordsError }] = await Promise.all([
    supabase
      .from('subscriber_preferences')
      .select('format_preference, pace_preference')
      .eq('subscriber_id', subscriberId)
      .maybeSingle(),
    supabase
      .from('subscriber_follows')
      .select('taxonomy_id')
      .eq('subscriber_id', subscriberId),
    supabase
      .from('subscriber_keywords')
      .select('phrase')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: true }),
  ])

  if (prefError) throw new Error(`Failed to load preferences: ${prefError.message}`)
  if (followsError) throw new Error(`Failed to load follows: ${followsError.message}`)
  if (keywordsError) throw new Error(`Failed to load keywords: ${keywordsError.message}`)

  const followedIds = (follows ?? []).map(row => (row as { taxonomy_id: string }).taxonomy_id)
  const split = splitFollows(taxonomy, followedIds)

  return {
    subscriberId,
    formatPreference: (pref?.format_preference as FormatPreference | undefined) ?? DEFAULT_FORMAT,
    pacePreference: (pref?.pace_preference as PacePreference | undefined) ?? DEFAULT_PACE,
    keywords: (keywords ?? []).map(row => (row as { phrase: string }).phrase),
    ...split,
  }
}

export async function upsertPreferences(subscriberId: string, payload: PreferencePayload): Promise<void> {
  const supabase = createAdminClient()
  const followIds = [
    ...new Set([
      ...payload.topicIds,
      ...payload.regionIds,
      ...payload.sectionIds,
    ]),
  ]
  const keywords = normalizeKeywords(payload.keywords)

  const { error: prefError } = await supabase
    .from('subscriber_preferences')
    .upsert({
      subscriber_id: subscriberId,
      format_preference: payload.formatPreference,
      pace_preference: payload.pacePreference,
      updated_at: new Date().toISOString(),
    })
  if (prefError) throw new Error(`Failed to save preferences: ${prefError.message}`)

  const { error: deleteError } = await supabase
    .from('subscriber_follows')
    .delete()
    .eq('subscriber_id', subscriberId)
  if (deleteError) throw new Error(`Failed to reset follows: ${deleteError.message}`)

  const { error: keywordDeleteError } = await supabase
    .from('subscriber_keywords')
    .delete()
    .eq('subscriber_id', subscriberId)
  if (keywordDeleteError) throw new Error(`Failed to reset keywords: ${keywordDeleteError.message}`)

  if (followIds.length > 0) {
    const { error: insertError } = await supabase
      .from('subscriber_follows')
      .insert(followIds.map(taxonomyId => ({ subscriber_id: subscriberId, taxonomy_id: taxonomyId })))
    if (insertError) throw new Error(`Failed to save follows: ${insertError.message}`)
  }

  if (keywords.length > 0) {
    const { error: keywordInsertError } = await supabase
      .from('subscriber_keywords')
      .insert(keywords.map(phrase => ({ subscriber_id: subscriberId, phrase })))
    if (keywordInsertError) throw new Error(`Failed to save keywords: ${keywordInsertError.message}`)
  }
}

export async function resetPersonalization(subscriberId: string): Promise<void> {
  const supabase = createAdminClient()
  const [{ error: followsError }, { error: prefError }, { error: keywordsError }] = await Promise.all([
    supabase.from('subscriber_follows').delete().eq('subscriber_id', subscriberId),
    supabase.from('subscriber_preferences').delete().eq('subscriber_id', subscriberId),
    supabase.from('subscriber_keywords').delete().eq('subscriber_id', subscriberId),
  ])
  if (followsError) throw new Error(`Failed to clear follows: ${followsError.message}`)
  if (prefError) throw new Error(`Failed to clear preferences: ${prefError.message}`)
  if (keywordsError) throw new Error(`Failed to clear keywords: ${keywordsError.message}`)
}

export async function follow(subscriberId: string, taxonomyId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('subscriber_follows')
    .upsert({ subscriber_id: subscriberId, taxonomy_id: taxonomyId })
  if (error) throw new Error(`Failed to follow taxonomy item: ${error.message}`)
}

export async function unfollow(subscriberId: string, taxonomyId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('subscriber_follows')
    .delete()
    .eq('subscriber_id', subscriberId)
    .eq('taxonomy_id', taxonomyId)
  if (error) throw new Error(`Failed to unfollow taxonomy item: ${error.message}`)
}

function normalizeKeywords(keywords: string[]): string[] {
  return [...new Set(
    keywords
      .map(keyword => keyword.trim().replace(/\s+/g, ' ').toLowerCase())
      .filter(keyword => keyword.length >= 2 && keyword.length <= 80)
  )].slice(0, MAX_KEYWORDS)
}
