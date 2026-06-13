import { describe, expect, it } from 'vitest'

import { getIssueTrackerForStory, issueSearchTokens, slugifyIssue } from './issue-trackers'

describe('issue trackers', () => {
  it('creates stable slugs from issue queries', () => {
    expect(slugifyIssue('NASA JPL')).toBe('nasa-jpl')
  })

  it('builds an issue tracker from a story subject', () => {
    const issue = getIssueTrackerForStory({
      title: 'NASA JPL gutted by staffing cuts',
      description: 'A former scientist said the Trump administration cuts reduced atmospheric monitoring capacity.',
      region: null,
      source: 'Democracy Now',
      journalist_username: 'democracynow',
    }, 'contested_partisan_politics')

    expect(issue).toEqual({ slug: 'nasa-jpl', title: 'Nasa Jpl', query: 'nasa jpl' })
  })

  it('extracts bounded search tokens', () => {
    expect(issueSearchTokens('NASA JPL staffing cuts follow-up')).toEqual(['nasa', 'jpl', 'staffing', 'cuts', 'follow'])
  })
})
