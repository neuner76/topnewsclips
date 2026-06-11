import type { SupabaseClient } from '@supabase/supabase-js'
import type { Story } from './types'
import type { TaxonomyItem } from './personalization-types'

type StoryForTagging = Pick<
  Story,
  'id' | 'title' | 'description' | 'category' | 'region' | 'msm_gap' | 'source_type' | 'journalist_username' | 'source'
>

interface TagMatch {
  taxonomyId: string
  confidence: number
}

interface BackfillResult {
  scanned: number
  taggedStories: number
  tagRows: number
  errors: string[]
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'politics-government': [
    'congress', 'senate', 'white house', 'trump', 'biden', 'election', 'court', 'judge',
    'police', 'ice', 'border', 'law', 'government', 'policy', 'military', 'war', 'gaza',
    'iran', 'ukraine', 'russia', 'china', 'tariff', 'protest', 'rights',
  ],
  'world-affairs': [
    'gaza', 'israel', 'iran', 'ukraine', 'russia', 'china', 'nato', 'united nations',
    'ceasefire', 'strike', 'missile', 'border', 'diplomat', 'sanction', 'foreign',
    'al jazeera', 'france 24', 'dw news', 'wion', 'trt world', 'africa',
  ],
  science: [
    'research', 'study', 'scientist', 'space', 'nasa', 'moon', 'climate', 'weather',
    'biology', 'physics', 'astronom', 'experiment', 'vaccine', 'disease',
  ],
  health: [
    'health', 'hospital', 'doctor', 'patient', 'medicine', 'drug', 'vaccine',
    'disease', 'covid', 'cancer', 'mental health', 'care', 'medicare',
  ],
  'technology-ai': [
    'ai', 'artificial intelligence', 'openai', 'google', 'apple', 'microsoft',
    'chip', 'semiconductor', 'robot', 'software', 'cyber', 'data', 'privacy',
    'tiktok', 'meta', 'tesla', 'spacex',
  ],
  'business-markets': [
    'market', 'stocks', 'economy', 'inflation', 'jobs', 'labor', 'company',
    'earnings', 'bank', 'fed', 'rate', 'tariff', 'price', 'housing', 'private equity',
    'retirement', '401(k)', 'workers', 'strike',
  ],
  'climate-environment': [
    'climate', 'environment', 'pollution', 'emissions', 'wildfire', 'hurricane',
    'flood', 'heat', 'storm', 'drought', 'energy', 'oil', 'gas', 'solar', 'wind',
  ],
  'media-information': [
    'media', 'journalism', 'misinformation', 'disinformation', 'propaganda',
    'social media', 'platform', 'algorithm', 'censorship', 'press',
  ],
  'justice-courts': [
    'court', 'judge', 'trial', 'lawsuit', 'justice', 'prison', 'police', 'sheriff',
    'bodycam', 'arrest', 'charges', 'sentenced', 'supreme court', 'attorney',
  ],
  education: [
    'school', 'student', 'teacher', 'college', 'university', 'education',
    'campus', 'tuition', 'classroom',
  ],
  sports: [
    'nba', 'nfl', 'mlb', 'soccer', 'football', 'basketball', 'athlete',
    'coach', 'game', 'match', 'world cup', 'olympic',
  ],
  'culture-society': [
    'film', 'music', 'celebrity', 'artist', 'culture', 'religion', 'community',
    'family', 'travel', 'food', 'festival', 'social', 'comedy', 'satire',
  ],
}

const REGION_KEYWORDS: Record<string, string[]> = {
  'north-america': ['united states', 'u.s.', 'us ', 'america', 'canada', 'mexico'],
  'latin-america': ['latin america', 'brazil', 'argentina', 'chile', 'colombia', 'venezuela', 'mexico'],
  europe: ['europe', 'uk', 'britain', 'france', 'germany', 'italy', 'spain', 'russia', 'ukraine', 'nato'],
  'middle-east': ['middle east', 'israel', 'gaza', 'iran', 'iraq', 'syria', 'lebanon', 'qatar', 'saudi'],
  africa: ['africa', 'kenya', 'nigeria', 'south africa', 'sudan', 'ethiopia'],
  'south-asia': ['india', 'pakistan', 'bangladesh', 'sri lanka', 'south asia'],
  'east-asia-pacific': ['china', 'japan', 'korea', 'taiwan', 'australia', 'pacific', 'philippines'],
  'global-multi-region': ['world', 'global', 'international', 'united nations', 'reuters', 'afp'],
}

const REGION_ALIASES: Record<string, string> = {
  canada: 'north-america',
  australia: 'east-asia-pacific',
  world: 'global-multi-region',
  global: 'global-multi-region',
  europe: 'europe',
  africa: 'africa',
  japan: 'east-asia-pacific',
  korea: 'east-asia-pacific',
}

function textFor(story: StoryForTagging): string {
  return [
    story.title,
    story.description,
    story.category,
    story.region,
    story.source_type,
    story.journalist_username,
    story.source,
  ].filter(Boolean).join(' ').toLowerCase()
}

function scoreKeywords(text: string, keywords: string[]): number {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
}

function chooseBest(slugToId: Map<string, string>, scores: Record<string, number>): TagMatch | null {
  const best = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .find(([slug]) => slugToId.has(slug))
  if (!best) return null

  const taxonomyId = slugToId.get(best[0])!
  return { taxonomyId, confidence: Math.min(0.95, 0.55 + best[1] * 0.12) }
}

export function inferStoryTags(story: StoryForTagging, taxonomy: TaxonomyItem[]): TagMatch[] {
  const slugToId = new Map(taxonomy.map(item => [item.slug, item.id]))
  const text = textFor(story)
  const tags: TagMatch[] = []

  const topicScores = Object.fromEntries(
    Object.entries(TOPIC_KEYWORDS).map(([slug, keywords]) => [slug, scoreKeywords(text, keywords)])
  )
  if (story.category === 'comedy') topicScores['culture-society'] += 2
  if (story.category === 'analysis') topicScores['media-information'] += 1
  const topic = chooseBest(slugToId, topicScores)
  if (topic) tags.push(topic)

  const rawRegion = (story.region ?? '').toLowerCase()
  const explicitRegionSlug = REGION_ALIASES[rawRegion]
  const region = explicitRegionSlug && slugToId.has(explicitRegionSlug)
    ? { taxonomyId: slugToId.get(explicitRegionSlug)!, confidence: 0.9 }
    : chooseBest(slugToId, Object.fromEntries(
      Object.entries(REGION_KEYWORDS).map(([slug, keywords]) => [slug, scoreKeywords(text, keywords)])
    ))
  if (region) tags.push(region)

  if (story.region && slugToId.has('global-blindspot') && story.msm_gap) {
    tags.push({ taxonomyId: slugToId.get('global-blindspot')!, confidence: 0.95 })
  }
  if (story.region && slugToId.has('global-lens') && !story.msm_gap) {
    tags.push({ taxonomyId: slugToId.get('global-lens')!, confidence: 0.75 })
  }
  if (story.msm_gap && slugToId.has('limited-coverage')) {
    tags.push({ taxonomyId: slugToId.get('limited-coverage')!, confidence: 0.9 })
  }

  return [...new Map(tags.map(tag => [tag.taxonomyId, tag])).values()]
}

export async function tagStory(
  supabase: SupabaseClient,
  story: StoryForTagging,
  taxonomy?: TaxonomyItem[]
): Promise<number> {
  const activeTaxonomy = taxonomy ?? await loadTaxonomy(supabase)
  const tags = inferStoryTags(story, activeTaxonomy)
  if (tags.length === 0) return 0

  const { error } = await supabase.from('story_tags').upsert(
    tags.map(tag => ({
      story_id: story.id,
      taxonomy_id: tag.taxonomyId,
      confidence: tag.confidence,
      tagged_by: 'model',
    })),
    { onConflict: 'story_id,taxonomy_id' }
  )
  if (error) throw new Error(`Failed to tag ${story.id}: ${error.message}`)
  return tags.length
}

export async function tagStoryBySlug(supabase: SupabaseClient, slug: string): Promise<number> {
  const { data: story, error } = await supabase
    .from('stories')
    .select('id, title, description, category, region, msm_gap, source_type, journalist_username, source')
    .eq('slug', slug)
    .single()
  if (error || !story) throw new Error(`Failed to load story ${slug}: ${error?.message ?? 'not found'}`)
  return tagStory(supabase, story as StoryForTagging)
}

export async function backfillStoryTags(supabase: SupabaseClient, days = 14): Promise<BackfillResult> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, title, description, category, region, msm_gap, source_type, journalist_username, source')
    .eq('published', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to load stories for tag backfill: ${error.message}`)

  const taxonomy = await loadTaxonomy(supabase)
  const result: BackfillResult = { scanned: stories?.length ?? 0, taggedStories: 0, tagRows: 0, errors: [] }

  for (const story of (stories ?? []) as StoryForTagging[]) {
    try {
      const count = await tagStory(supabase, story, taxonomy)
      if (count > 0) result.taggedStories++
      result.tagRows += count
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return result
}

async function loadTaxonomy(supabase: SupabaseClient): Promise<TaxonomyItem[]> {
  const { data, error } = await supabase
    .from('taxonomy')
    .select('id, kind, slug, label, active')
    .eq('active', true)

  if (error) throw new Error(`Failed to load taxonomy: ${error.message}`)
  return (data ?? []) as TaxonomyItem[]
}
