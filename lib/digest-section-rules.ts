// Section-shaping rules: Need To Know bounds + buried-lead floor (Task 4b),
// duplicate-topic suppression (Task 6). These are relational — they operate
// against a DigestContext that accumulates as the digest fills.

import { digestTopicKey } from './digest-role-classifier'
import { DIGEST_LEAD_STRENGTH } from './digest-pull-score'
import type { DigestContext, DigestItemRole } from './digest-pull-types'
import type { Story } from './types'

export const NEED_TO_KNOW_MIN = 2
export const NEED_TO_KNOW_MAX = 3

// Roles that justify a lower-section item on a topic the lead already covers.
// Anything else on the lead's topic is a redundant follow-up → archive.
const DISTINCT_FOLLOWUP_ROLES: DigestItemRole[] = [
  'institutional_signal',
  'undercovered_global',
  'mainstream_agenda_marker',
  'reader_utility',
]

type TopicableStory = Pick<Story, 'title' | 'description' | 'subcategory' | 'category'>

// Task 6. A lower-section item that repeats the lead's topic is suppressed
// unless it brings a distinct role (follow-up detail, global lens, next step).
export function isDuplicateLowerSectionItem(
  story: TopicableStory,
  role: DigestItemRole,
  context: DigestContext
): boolean {
  if (!context.leadTopic) return false
  if (digestTopicKey(story) !== context.leadTopic) return false
  return !DISTINCT_FOLLOWUP_ROLES.includes(role)
}

// Task 4b. A lead-strength story not placed in Need To Know is a buried lead —
// a critical defect, not a soft warning.
export function isBuriedLead(
  role: DigestItemRole,
  score: number,
  placedInNeedToKnow: boolean
): boolean {
  if (placedInNeedToKnow) return false
  return role === 'lead' || score >= DIGEST_LEAD_STRENGTH
}

// Accumulate a placed item into the running context so later classification
// and suppression decisions see it.
export function recordPlacement(
  context: DigestContext,
  story: TopicableStory,
  role: DigestItemRole,
  region: string | null,
  isLead: boolean
): DigestContext {
  const topic = digestTopicKey(story)
  return {
    rolesFilled: [...context.rolesFilled, role],
    topicsPresent: context.topicsPresent.includes(topic) ? context.topicsPresent : [...context.topicsPresent, topic],
    regionsPresent: region && !context.regionsPresent.includes(region)
      ? [...context.regionsPresent, region]
      : context.regionsPresent,
    leadTopic: isLead && !context.leadTopic ? topic : context.leadTopic,
  }
}
