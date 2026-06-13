import type { Story } from './types'
import type { StoryCategoryForResponse } from './response-types'
import { getRelatedSearchQuery } from './related-search'

type StoryForIssue = Pick<Story, 'title' | 'description' | 'region' | 'journalist_username' | 'source'>

export function slugifyIssue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'updates'
}

export function getIssueTrackerForStory(story: StoryForIssue, storyCategory: StoryCategoryForResponse): {
  slug: string
  title: string
  query: string
} {
  const query = getRelatedSearchQuery(story, storyCategory)
  return {
    slug: slugifyIssue(query),
    title: query.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    query,
  }
}

export function issueSearchTokens(query: string): string[] {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 3)
      .slice(0, 5)
  )]
}
