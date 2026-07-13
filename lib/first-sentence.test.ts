import { describe, expect, it } from 'vitest'
import { firstSentence } from './first-sentence'

describe('firstSentence', () => {
  it('does not break on a leading title abbreviation (Sen., Dr.)', () => {
    // Regression: rendered as "Sen." / "Dr." in the digest because the old
    // /^.*?[.!?]/ split stopped at the abbreviation period.
    expect(firstSentence('Sen. Lindsey Graham died Saturday at age 71, according to NBC News.'))
      .toBe('Sen. Lindsey Graham died Saturday at age 71, according to NBC News.')
    expect(firstSentence('Dr. Lonnie Johnson claims a breakthrough. He built a heat engine.'))
      .toBe('Dr. Lonnie Johnson claims a breakthrough.')
  })

  it('does not break on a mid-sentence title abbreviation', () => {
    expect(firstSentence('Ukrainian President Zelenskyy honored Sen. Graham as a defender. Then more.'))
      .toBe('Ukrainian President Zelenskyy honored Sen. Graham as a defender.')
  })

  it('does not break inside a dotted acronym (U.S.)', () => {
    expect(firstSentence('U.S. strikes 140 Iranian targets. Iran retaliates.'))
      .toBe('U.S. strikes 140 Iranian targets.')
  })

  it('returns the first sentence for ordinary prose', () => {
    expect(firstSentence('Congress passed the bill. It was historic.')).toBe('Congress passed the bill.')
  })

  it('returns the whole string when there is no sentence break', () => {
    expect(firstSentence('VICE News reports the ceasefire has collapsed')).toBe('VICE News reports the ceasefire has collapsed')
  })

  it('handles empty / whitespace input', () => {
    expect(firstSentence('')).toBe('')
    expect(firstSentence('   ')).toBe('')
  })

  it('respects question and exclamation boundaries', () => {
    expect(firstSentence('Is it true? Yes it is.')).toBe('Is it true?')
  })
})
