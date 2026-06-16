import { describe, expect, it } from 'vitest'
import { fixtures } from './digest-fixtures'
import { compareNeedToKnowByCorroboration, type PulledItem } from './digest-assembly'
import { calculateDigestPullScore } from './digest-pull-score'
import { evaluateLeadEligibility, SUSPECT_COVERAGE_LEAD_JUSTIFICATION } from './lead-eligibility'
import { validateDigestPullQuality } from './digest-pull-quality'
import type { DigestEdition, CanonicalNeedToKnowItem } from './digest-canonical'
import type { Story } from './types'

function pulled(story: Story): PulledItem {
  const { role, score, riskFlags } = calculateDigestPullScore(story)
  return { story, section: 'Need To Know', pull: { role, pullScore: score, pullReason: '', riskFlags }, caution: null, isLead: false }
}

describe('corroboration-aware NTK comparator (Task 5)', () => {
  it('ranks a 13/14 corroborated story above two suspect-zero items (the live inversion)', () => {
    const corroborated = pulled(fixtures.corroboratedMajorStory)
    const suspect1 = pulled(fixtures.highSalienceDomesticZeroCoverage)
    const suspect2 = pulled({ ...fixtures.highSalienceDomesticZeroCoverage, slug: 'shooting2', title: 'Gunman opens fire, several wounded in a mass shooting downtown' })

    const ordered = [suspect1, suspect2, corroborated].sort(compareNeedToKnowByCorroboration)
    expect(ordered[0].story.slug).toBe(fixtures.corroboratedMajorStory.slug)
  })

  it('does not let a developing low-coverage label float above a corroborated story', () => {
    const corroborated = pulled(fixtures.corroboratedMajorStory)
    const developing = pulled(fixtures.developingSecondaryStory)
    const ordered = [developing, corroborated].sort(compareNeedToKnowByCorroboration)
    expect(ordered[0].story.slug).toBe(fixtures.corroboratedMajorStory.slug)
  })
})

describe('suspect coverage at the lead gate (Task 4)', () => {
  it('makes a suspect high-salience zero override_required with the coverage-unverified justification', () => {
    const result = evaluateLeadEligibility(fixtures.highSalienceDomesticZeroCoverage)
    expect(result.status).toBe('override_required')
    expect(result.requiredOverrideReason).toBe(SUSPECT_COVERAGE_LEAD_JUSTIFICATION)
    // never the generic undercovered line
    expect(result.reasons.join(' ')).not.toMatch(/may be important and undercovered/i)
  })
})

describe('NTK inversion validation (Task 6)', () => {
  function ntk(id: string): CanonicalNeedToKnowItem {
    return {
      id, section: 'Need To Know', title: id, summary: 'x', url: `/story/${id}`,
      metadata: { source: 'x', sourceType: 'x', sourceTier: 5, confidence: 'Reported', coverageCount: 0, coverageTotal: 15, handle: null },
      whatHappened: 'x', whyItMatters: 'y', worldView: [],
    }
  }
  function edition(over: Partial<DigestEdition>): DigestEdition {
    return { id: 'd', date: '2026-06-15', title: 't', needToKnow: [], sections: [], mainstreamPulse: null, globalBlindspot: [], globalLens: [], ...over }
  }

  it('flags Need To Know ordering that puts a suspect zero above a corroborated story', () => {
    const ed = edition({ needToKnow: [ntk('shooting'), ntk('corroborated')] })
    const map = new Map<string, Story>([
      ['shooting', fixtures.highSalienceDomesticZeroCoverage],
      ['corroborated', fixtures.corroboratedMajorStory],
    ])
    const report = validateDigestPullQuality(ed, map)
    expect(report.errors.some(e => /ordering inverts corroboration/.test(e))).toBe(true)
  })
})
