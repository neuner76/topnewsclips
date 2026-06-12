import type { Story } from './types'
import type { ResponseType, StoryCategoryForResponse, StoryResponseEligibility } from './response-types'

export interface ResponseEligibilityResult {
  storyCategory: StoryCategoryForResponse
  eligibility: StoryResponseEligibility
  allowedTypes: ResponseType[]
  reason: string
}

type StoryLike = Pick<Story, 'title' | 'description' | 'category' | 'subcategory' | 'region' | 'source_type'> & {
  responseCategoryOverride?: StoryCategoryForResponse | null
  responseEligibilityOverride?: StoryResponseEligibility | null
}

const LEARN_TRACK: ResponseType[] = ['learn', 'track']
const LEARN_TRACK_SHARE: ResponseType[] = ['learn', 'track', 'share_responsibly']

const CATEGORY_RULES: Record<StoryCategoryForResponse, Omit<ResponseEligibilityResult, 'storyCategory'>> = {
  disaster_relief: {
    eligibility: 'limited',
    allowedTypes: ['learn', 'track', 'official_process', 'local_resource', 'support_verified_response'],
    reason: 'Disaster stories can show official updates and local resources, but support links require human approval.',
  },
  consumer_fraud: {
    eligibility: 'full',
    allowedTypes: ['learn', 'track', 'report', 'official_process'],
    reason: 'Consumer fraud stories can point readers to official reporting and complaint pathways.',
  },
  public_health_logistics: {
    eligibility: 'full',
    allowedTypes: ['learn', 'track', 'official_process', 'local_resource'],
    reason: 'Public health logistics stories can include official updates and local resource information.',
  },
  elections_civic_deadlines: {
    eligibility: 'full',
    allowedTypes: ['learn', 'track', 'official_process'],
    reason: 'Election and civic deadline stories may include official process links only.',
  },
  public_comment_period: {
    eligibility: 'full',
    allowedTypes: ['learn', 'track', 'official_process'],
    reason: 'The official process is the story, so public comment or deadline links may be shown.',
  },
  local_infrastructure_safety: {
    eligibility: 'full',
    allowedTypes: ['learn', 'track', 'official_process', 'report', 'local_resource'],
    reason: 'Local safety stories can include official reporting and public service resources.',
  },
  geopolitical_conflict: {
    eligibility: 'learn_track_share_only',
    allowedTypes: LEARN_TRACK_SHARE,
    reason: 'Geopolitical conflict is limited to learning, tracking, and careful sharing.',
  },
  contested_partisan_politics: {
    eligibility: 'learn_track_share_only',
    allowedTypes: LEARN_TRACK_SHARE,
    reason: 'Contested political stories are limited to learning, tracking, and careful sharing.',
  },
  active_violence_breaking_crisis: {
    eligibility: 'limited',
    allowedTypes: LEARN_TRACK,
    reason: 'Breaking violence and active crisis stories are limited to learning and tracking.',
  },
  culture_novelty_light: {
    eligibility: 'none',
    allowedTypes: [],
    reason: 'Light culture and novelty stories do not receive response prompts by default.',
  },
  other: {
    eligibility: 'limited',
    allowedTypes: LEARN_TRACK,
    reason: 'Unknown story types default to learning and tracking only.',
  },
}

const termMatch = (text: string, terms: string[]) => terms.some(term => text.includes(term))

export function classifyStoryForResponse(story: StoryLike): StoryCategoryForResponse {
  if (story.responseCategoryOverride) return story.responseCategoryOverride

  const text = `${story.title} ${story.description ?? ''} ${story.subcategory ?? ''}`.toLowerCase()

  if (termMatch(text, ['active shooter', 'mass shooting', 'shelter in place', 'hostage', 'bomb threat', 'explosion', 'breaking crisis'])) {
    return 'active_violence_breaking_crisis'
  }
  if (termMatch(text, ['war', 'airstrike', 'missile', 'ceasefire', 'gaza', 'israel', 'iran', 'ukraine', 'russia', 'nato', 'hostages', 'military strike'])) {
    return 'geopolitical_conflict'
  }
  if (termMatch(text, ['trump', 'biden', 'democrat', 'republican', 'gop', 'congress', 'senate', 'white house', 'campaign', 'impeachment', 'epstein files'])) {
    return 'contested_partisan_politics'
  }
  if (termMatch(text, ['public comment', 'comment period', 'hearing deadline', 'agency deadline'])) {
    return 'public_comment_period'
  }
  if (termMatch(text, ['voter registration', 'ballot deadline', 'polling place', 'election deadline', 'primary deadline'])) {
    return 'elections_civic_deadlines'
  }
  if (termMatch(text, ['fraud', 'scam', 'consumer complaint', 'data breach', 'identity theft', 'deceptive billing'])) {
    return 'consumer_fraud'
  }
  if (termMatch(text, ['recall', 'vaccine', 'public health', 'hospital capacity', 'clinic', 'medicaid', 'medicare', 'food safety'])) {
    return 'public_health_logistics'
  }
  if (termMatch(text, ['hurricane', 'wildfire', 'flood', 'tornado', 'earthquake', 'evacuation', 'disaster relief'])) {
    return 'disaster_relief'
  }
  if (termMatch(text, ['bridge collapse', 'water main', 'utility outage', 'power outage', 'road closure', 'school safety', 'transit safety', 'infrastructure'])) {
    return 'local_infrastructure_safety'
  }
  if (story.category === 'comedy' || termMatch(text, ['botanic garden', 'nature trail', 'celebrity', 'award show', 'movie trailer', 'sports highlights'])) {
    return 'culture_novelty_light'
  }

  return 'other'
}

export function getResponseEligibility(story: StoryLike): ResponseEligibilityResult {
  const storyCategory = classifyStoryForResponse(story)
  const base = CATEGORY_RULES[storyCategory]

  if (!story.responseEligibilityOverride) return { storyCategory, ...base }

  if (story.responseEligibilityOverride === 'none') {
    return { storyCategory, eligibility: 'none', allowedTypes: [], reason: 'Response prompts are disabled by manual override.' }
  }

  if (story.responseEligibilityOverride === 'learn_track_share_only') {
    return { storyCategory, eligibility: 'learn_track_share_only', allowedTypes: LEARN_TRACK_SHARE, reason: 'Manual override limits this story to learning, tracking, and careful sharing.' }
  }

  if (story.responseEligibilityOverride === 'limited') {
    return { storyCategory, eligibility: 'limited', allowedTypes: LEARN_TRACK, reason: 'Manual override limits this story to learning and tracking.' }
  }

  return { storyCategory, ...base }
}
