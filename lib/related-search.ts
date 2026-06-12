import type { Story } from './types'
import type { StoryCategoryForResponse } from './response-types'

type StoryForSearch = Pick<Story, 'title' | 'description' | 'region' | 'journalist_username' | 'source'>

const STOP_WORDS = new Set([
  'about', 'after', 'amid', 'and', 'are', 'as', 'at', 'from', 'has', 'have',
  'into', 'its', 'launches', 'latest', 'more', 'new', 'over', 'says', 'that',
  'the', 'this', 'through', 'tied', 'today', 'with',
])

const PRIORITY_TERMS_BY_CATEGORY: Partial<Record<StoryCategoryForResponse, string[]>> = {
  geopolitical_conflict: [
    'iran', 'israel', 'gaza', 'hamas', 'ukraine', 'russia', 'nato', 'china',
    'taiwan', 'saudi', 'afghanistan', 'pakistan', 'ceasefire', 'airstrike',
    'missile', 'sanctions', 'hormuz',
  ],
  contested_partisan_politics: [
    'epstein', 'trump', 'biden', 'congress', 'senate', 'white house',
    'supreme court', 'election', 'campaign',
  ],
  public_health_logistics: ['medicare', 'medicaid', 'vaccine', 'recall', 'hospital', 'clinic'],
  consumer_fraud: ['fraud', 'scam', 'data breach', 'identity theft'],
  disaster_relief: ['flood', 'wildfire', 'hurricane', 'tornado', 'earthquake', 'evacuation'],
}

export function getRelatedSearchQuery(story: StoryForSearch, storyCategory: StoryCategoryForResponse): string {
  const text = `${story.title} ${story.description ?? ''} ${story.region ?? ''} ${story.source ?? ''} ${story.journalist_username ?? ''}`.toLowerCase()
  const priorityTerms = PRIORITY_TERMS_BY_CATEGORY[storyCategory] ?? []
  const match = priorityTerms.find(term => text.includes(term))
  if (match) return match

  const words = story.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOP_WORDS.has(word))

  const uniqueWords = [...new Set(words)]
  return uniqueWords.slice(0, 2).join(' ') || story.title.split(/\s+/).slice(0, 2).join(' ')
}
