import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DigestContent,
  EtceteraItem,
  GlobalBlindspotItem,
  GlobalLensItem,
  InTheKnowItem,
  NeedToKnowItem,
} from './digest'
import type { FormatPreference, PacePreference } from './personalization-types'
import { keywordMatchesText, normalizeKeywordList } from './keyword-preferences'

interface SubscriberPreferenceRow {
  format_preference: FormatPreference | null
  pace_preference: PacePreference | null
}

export interface PersonalizationProfile {
  followedTaxonomyIds: Set<string>
  customKeywords: string[]
  formatPreference: FormatPreference
  pacePreference: PacePreference
}

const DEFAULT_PROFILE: PersonalizationProfile = {
  followedTaxonomyIds: new Set(),
  customKeywords: [],
  formatPreference: 'both',
  pacePreference: 'full',
}

type SluggedItem =
  | NeedToKnowItem
  | InTheKnowItem
  | EtceteraItem
  | GlobalBlindspotItem
  | GlobalLensItem

function cloneDigest(content: DigestContent): DigestContent {
  return JSON.parse(JSON.stringify(content)) as DigestContent
}

function itemSlug(item: SluggedItem): string | null {
  return 'slug' in item ? item.slug : null
}

function itemSearchText(item: SluggedItem): string {
  if ('sectionTitle' in item) {
    return [
      item.sectionTitle,
      item.paragraphs.join(' '),
      item.howWorldSeesIt?.map(world => `${world.title ?? ''} ${world.summary}`).join(' ') ?? '',
    ].join(' ').toLowerCase()
  }
  if ('text' in item) return item.text.toLowerCase()
  return [item.title, item.region, item.summary].join(' ').toLowerCase()
}

function collectSlugs(content: DigestContent): string[] {
  return [...new Set([
    ...content.needToKnow.map(item => item.slug),
    ...Object.values(content.inTheKnow).flatMap(items => items.map(item => item.slug).filter(Boolean) as string[]),
    ...content.etcetera.map(item => typeof item === 'string' ? null : item.slug).filter(Boolean) as string[],
    ...(content.globalBlindspots ?? []).map(item => item.slug),
    ...(content.globalLens ?? []).map(item => item.slug),
  ])]
}

function sortByScore<T extends SluggedItem>(items: T[], scoreForItem: (item: T) => number): T[] {
  return [...items]
    .map((item, index) => ({ item, index, score: scoreForItem(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item)
}

function trimNeedToKnow(item: NeedToKnowItem): NeedToKnowItem {
  return {
    ...item,
    paragraphs: item.paragraphs.slice(0, 2),
    howWorldSeesIt: item.howWorldSeesIt?.slice(0, 1),
  }
}

export async function getPersonalizationProfile(
  supabase: SupabaseClient,
  subscriberId: string
): Promise<PersonalizationProfile> {
  const [{ data: pref }, { data: follows }, { data: keywords }] = await Promise.all([
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

  return {
    followedTaxonomyIds: new Set((follows ?? []).map((row: { taxonomy_id: string }) => row.taxonomy_id)),
    customKeywords: normalizeKeywordList((keywords ?? []).map((row: { phrase: string }) => row.phrase)),
    formatPreference: ((pref as SubscriberPreferenceRow | null)?.format_preference ?? DEFAULT_PROFILE.formatPreference),
    pacePreference: DEFAULT_PROFILE.pacePreference,
  }
}

export async function personalizeDigestContent(
  supabase: SupabaseClient,
  content: DigestContent,
  profile: PersonalizationProfile
): Promise<DigestContent> {
  const personalized = cloneDigest(content)
  const slugs = collectSlugs(content)
  const hasTagPreferences = profile.followedTaxonomyIds.size > 0
  const hasKeywordPreferences = profile.customKeywords.length > 0
  if (slugs.length === 0 || (!hasTagPreferences && !hasKeywordPreferences)) {
    return applyPaceAndFormat(personalized, profile)
  }

  const slugScores = new Map<string, number>()

  if (hasTagPreferences) {
    const { data: tagRows } = await supabase
      .from('story_tags')
      .select('taxonomy_id, stories!inner(slug)')
      .in('stories.slug', slugs)

    for (const row of (tagRows ?? []) as Array<{ taxonomy_id: string; stories: { slug: string } | { slug: string }[] }>) {
      if (!profile.followedTaxonomyIds.has(row.taxonomy_id)) continue
      const joinedStory = Array.isArray(row.stories) ? row.stories[0] : row.stories
      const slug = joinedStory?.slug
      if (!slug) continue
      slugScores.set(slug, (slugScores.get(slug) ?? 0) + 1)
    }
  }

  const scoreForItem = (item: SluggedItem) => {
    const slug = itemSlug(item)
    let score = slug ? (slugScores.get(slug) ?? 0) : 0
    if (hasKeywordPreferences) {
      const text = itemSearchText(item)
      score += profile.customKeywords.filter(keyword => keywordMatchesText(text, keyword)).length * 2
    }
    return score
  }

  personalized.needToKnow = sortByScore(personalized.needToKnow, item => scoreForItem(item))
  for (const category of Object.keys(personalized.inTheKnow) as Array<keyof DigestContent['inTheKnow']>) {
    personalized.inTheKnow[category] = sortByScore(personalized.inTheKnow[category], item => scoreForItem(item))
  }
  personalized.etcetera = sortByScore(
    personalized.etcetera.filter((item): item is Exclude<EtceteraItem, string> => typeof item !== 'string'),
    item => scoreForItem(item)
  )
  personalized.globalBlindspots = personalized.globalBlindspots
    ? sortByScore(personalized.globalBlindspots, item => scoreForItem(item))
    : personalized.globalBlindspots
  personalized.globalLens = personalized.globalLens
    ? sortByScore(personalized.globalLens, item => scoreForItem(item))
    : personalized.globalLens

  return applyPaceAndFormat(personalized, profile)
}

function applyPaceAndFormat(content: DigestContent, profile: PersonalizationProfile): DigestContent {
  if (profile.formatPreference === 'clips') {
    content.globalBlindspots = content.globalBlindspots?.slice(0, 3)
    content.globalLens = content.globalLens?.slice(0, 3)
  }

  if (profile.pacePreference !== 'skim') return content

  content.needToKnow = content.needToKnow.slice(0, 2).map(trimNeedToKnow)
  for (const category of Object.keys(content.inTheKnow) as Array<keyof DigestContent['inTheKnow']>) {
    content.inTheKnow[category] = content.inTheKnow[category].slice(0, 2)
  }
  content.etcetera = content.etcetera.slice(0, 3)
  content.mainstreamPulse = content.mainstreamPulse?.slice(0, 4)
  content.globalBlindspots = content.globalBlindspots?.slice(0, 2)
  content.globalLens = content.globalLens?.slice(0, 2)

  return content
}
