// Task 2 — classify the editorial ROLE a story plays in the canonical digest.
//
// Classification is relational: it receives a DigestContext describing what the
// digest already holds, so a follow-up on a topic already led (e.g. a second
// Iran story when Iran is the lead) classifies toward a distinct role or
// archive_only rather than competing for the lead slot.

import { getConfidenceLabel } from './confidence'
import { coverageCount } from './feed-editorial'
import { isHighStakesGeopolitical, isStateAffiliated } from './digest-risk'
import type { DigestContext, DigestItemRole } from './digest-pull-types'
import type { Story } from './types'

type ClassifiableStory = Pick<
  Story,
  | 'title' | 'description' | 'subcategory' | 'category'
  | 'source_tier' | 'source_type' | 'msm_outlet_coverage' | 'msm_gap'
  | 'journalist_username' | 'source' | 'region'
>

// Coarse topic buckets, used both to choose a role and to detect duplicate
// coverage of a topic already present (Task 6). Order matters: the first
// matching bucket wins, so more specific/high-stakes buckets come first.
const TOPIC_KEYWORDS: Array<[string, RegExp]> = [
  ['safety', /\b(shooting|active shooter|evacuat|tornado|hurricane|wildfire|flash flood|earthquake|mass casualt|amber alert|hazmat)\b/i],
  ['geopolitics', /\b(war|missile|strike|airstrike|troop|invasion|ceasefire|diplomat|sanction|nuclear|militia|insurgen|coup|hostage|frontline|annex)\b/i],
  ['migration', /\b(migrant|migration|asylum|refugee|border crossing|deportation)\b/i],
  ['markets', /\b(inflation|interest rate|ipo|stock|market|recession|tariff|trade deal|earnings|bankruptc|layoff|used[- ]car|consumer price)\b/i],
  ['health_science', /\b(disease|outbreak|virus|vaccine|screwworm|public health|fda|cdc|climate|drought|emission|research|study|species|wildlife|agricultur|pandemic)\b/i],
  ['institutional', /\b(court|ruling|supreme court|regulat|policy|legislation|congress|parliament|agency|deadline|infrastructure|bridge|pipeline|treaty|sanction)\b/i],
  ['culture', /\b(satire|comedy|documentary|retrospective|celebrity|festival|album|box office|streaming|sports)\b/i],
]

// A stable topic key for duplicate-topic suppression. Falls back to the first
// significant proper-noun-ish token so two stories about the same named subject
// (e.g. "Iran") collide even when no keyword bucket matched.
export function digestTopicKey(story: Pick<Story, 'title' | 'description' | 'subcategory' | 'category'>): string {
  const text = `${story.title ?? ''} ${story.description ?? ''} ${story.subcategory ?? ''}`
  for (const [key, re] of TOPIC_KEYWORDS) {
    if (re.test(text)) return key
  }
  const proper = (story.title ?? '').match(/\b[A-Z][a-zA-Z]{3,}\b/)
  return proper ? proper[0].toLowerCase() : 'general'
}

function isStrongSource(story: ClassifiableStory): boolean {
  const tier = story.source_tier ?? 99
  const label = getConfidenceLabel(story)
  return tier <= 6 || label === 'CORROBORATED' || label === 'REPORTED'
}

function isRawFootageOnly(story: ClassifiableStory): boolean {
  return story.category === 'raw' && coverageCount(story) <= 1 && !isStrongSource(story)
}

// Does this story add a DISTINCT role on a topic already led? (Task 6 helper.)
// A follow-up earns space only if it brings institutional/global/utility value.
function addsDistinctFollowupRole(story: ClassifiableStory): DigestItemRole | null {
  const topic = digestTopicKey(story)
  if (story.category === 'analysis') return null // pure re-analysis of the lead is not distinct
  if (topic === 'institutional') return 'institutional_signal'
  if (story.msm_gap || coverageCount(story) <= 2) return 'undercovered_global'
  if (topic === 'markets') return 'economic_context'
  return null
}

export function classifyDigestItemRole(story: ClassifiableStory, context: DigestContext): DigestItemRole {
  const topic = digestTopicKey(story)

  // Satire/comedy is always cultural texture, never a news role.
  if (story.category === 'comedy' || topic === 'culture') {
    if (story.category === 'comedy' || /\b(satire|documentary|retrospective|celebrity|festival|sports|album|box office)\b/i.test(`${story.title} ${story.description}`)) {
      return 'cultural_texture'
    }
  }

  // Raw footage with no corroboration and no editorial strength has no role
  // of its own — it belongs in the archive unless reframed with context.
  if (isRawFootageOnly(story)) return 'archive_only'

  // Breaking public-safety: valuable precisely when newest/least-covered.
  if (topic === 'safety') return 'developing_safety'

  // Duplicate-of-lead handling (Task 6): if this matches the lead's topic and
  // a lead already exists, it cannot be a second lead. It survives only with a
  // distinct follow-up role; otherwise archive.
  const duplicatesLead = context.leadTopic != null && context.leadTopic === topic
  if (duplicatesLead && context.rolesFilled.includes('lead')) {
    return addsDistinctFollowupRole(story) ?? 'archive_only'
  }

  // Lead: a major geopolitical/diplomatic or mass-casualty development with
  // strong sourcing (or a state outlet that will carry caution framing). Only
  // the first such story becomes the lead; later ones fall through to a role.
  const leadEligible =
    (topic === 'geopolitics' || topic === 'migration') &&
    (isStrongSource(story) || isStateAffiliated(story)) &&
    isHighStakesGeopolitical(story)
  if (leadEligible && !context.rolesFilled.includes('lead')) return 'lead'

  // Undercovered international story — checked BEFORE the topic switch. A
  // low-coverage story from an international outlet (region set, not World) is
  // a Global Blindspot item, not a front-page institutional/economic signal,
  // even when its subject is institutional. Catching it here keeps such stories
  // from being mistaken for buried leads. (US stories have region null and so
  // fall through to their topic role.)
  if ((story.msm_gap || coverageCount(story) <= 2) && story.region && story.region !== 'World') {
    return 'undercovered_global'
  }

  switch (topic) {
    case 'geopolitics':
    case 'migration':
    case 'institutional':
      return 'institutional_signal'
    case 'markets':
      return 'economic_context'
    case 'health_science':
      return 'health_science_context'
    default:
      break
  }

  // Weakly sourced, no clear bucket → archive.
  if (!isStrongSource(story)) return 'archive_only'

  // Sourced but roleless: a practical reader-impact story, else archive.
  if (/\b(price|recall|shortage|outage|closure|delay|safety|warning|deadline)\b/i.test(`${story.title} ${story.description}`)) {
    return 'practical_impact'
  }
  return 'archive_only'
}
