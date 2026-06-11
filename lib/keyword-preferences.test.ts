import { describe, expect, it } from 'vitest'

import { keywordMatchesText, normalizeKeywordList, normalizeKeywordPhrase } from './keyword-preferences'

describe('keyword preferences', () => {
  it('expands short ai interest into a meaningful phrase', () => {
    expect(normalizeKeywordPhrase('AI')).toBe('artificial intelligence')
    expect(normalizeKeywordList(['AI', 'private equity'])).toEqual([
      'artificial intelligence',
      'private equity',
    ])
  })

  it('matches custom interests as whole phrases', () => {
    expect(keywordMatchesText('South Korea is driven by artificial intelligence chip demand.', 'artificial intelligence')).toBe(true)
    expect(keywordMatchesText('Private equity fees appear in retirement funds.', 'private equity')).toBe(true)
    expect(keywordMatchesText('The word said should not match ai.', 'ai')).toBe(false)
  })
})
