import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import { suggestsGlobalBlindspot } from './digest-section-rules'

describe('Global Blindspot routing suggestion (Task 12)', () => {
  it('suggests Global Blindspot for a low-coverage international story', () => {
    expect(suggestsGlobalBlindspot(fixtures.lowCoverageInternationalStory)).toBe(true)
  })

  it('does not suggest it for a well-covered domestic story', () => {
    expect(suggestsGlobalBlindspot(fixtures.reportedCorroboratedLead)).toBe(false)
  })

  it('does not suggest it when the story is already in Need To Know', () => {
    expect(suggestsGlobalBlindspot(fixtures.lowCoverageInternationalStory, { alreadyNeedToKnow: true })).toBe(false)
  })

  it('does not suggest it for a low-coverage US (region null) story', () => {
    expect(suggestsGlobalBlindspot({ ...fixtures.lowCoverageInternationalStory, region: null })).toBe(false)
  })
})
