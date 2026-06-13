import type { DigestContent } from './digest'
import type { Story } from './types'
import { getResponseEligibility } from './response-eligibility'
import { getIssueTrackerForStory } from './issue-trackers'

export interface NewsletterNextStep {
  heading: string
  label: string
  description: string
  why: string
  url: string
  storySlug: string
  responseType: 'track' | 'learn' | 'share_responsibly'
}

export function selectNewsletterNextStep(content: DigestContent, storyMap: Map<string, Story>, siteUrl: string): NewsletterNextStep | null {
  const politicsItems = Array.isArray(content.inTheKnow?.['Politics & World Affairs'])
    ? content.inTheKnow['Politics & World Affairs']
    : []
  const candidateSlugs = [
    ...(Array.isArray(content.needToKnow) ? content.needToKnow.map(item => item.slug) : []),
    ...politicsItems.map(item => item.slug).filter((slug): slug is string => Boolean(slug)),
  ]

  for (const slug of candidateSlugs) {
    const story = storyMap.get(slug)
    if (!story) continue
    const eligibility = getResponseEligibility(story)
    if (eligibility.eligibility === 'none') continue
    if (!eligibility.allowedTypes.includes('track')) continue

    const issue = getIssueTrackerForStory(story, eligibility.storyCategory)
    return {
      heading: 'One useful next step',
      label: 'Track the story',
      description: `Follow related updates and open questions about ${issue.title}.`,
      why: eligibility.reason,
      url: `${siteUrl}/issues/${issue.slug}?q=${encodeURIComponent(issue.query)}&story=${encodeURIComponent(story.slug)}&utm_source=email&utm_medium=email&utm_campaign=newsletter_next_step`,
      storySlug: story.slug,
      responseType: 'track',
    }
  }

  return null
}
