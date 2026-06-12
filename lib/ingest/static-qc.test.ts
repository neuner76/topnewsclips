import { describe, expect, it, vi } from 'vitest'
import { runQCGate, runStaticQCChecks, type QCInput } from './qc-gate'

const anthropicCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: anthropicCreate,
    },
  })),
}))

const base: QCInput = {
  storyId: 'static-test',
  section: 'Politics',
  contentType: 'reported',
  confidenceLabel: 'Reported',
  headline: 'Test headline',
  summary: 'Test summary.',
  sourceName: 'Test Source',
  sourceTier: 5,
  videoPublishDate: null,
  eventDateEstimate: '2026-06-11',
  coverageCount: 3,
  rawSourceDescription: 'Test source description.',
}

function failedIds(input: QCInput): string[] {
  return runStaticQCChecks(input).map(check => check.id)
}

describe('static QC backstop', () => {
  it('flags raw creator promo copy in published summaries', () => {
    expect(failedIds({
      ...base,
      contentType: 'satire',
      confidenceLabel: 'Satire',
      summary: 'Check out joshjohnsoncomedy.com/tour. Hit me on them internets and follow me @joshjohnsoncomedy.',
    })).toContain('C1')
  })

  it('flags unnamed former presidents when the source names them', () => {
    expect(failedIds({
      ...base,
      summary: 'A former U.S. president was booed at the NBA Finals under these circumstances.',
      rawSourceDescription: 'BBC reports that former President Barack Obama was booed at Game 3.',
    })).toEqual(expect.arrayContaining(['C2', 'C3']))
  })

  it('flags archive or retrospective material in daily sections', () => {
    expect(failedIds({
      ...base,
      headline: "China's Island-Building in the South China Sea Reshapes the Region",
      summary: 'China has built military installations on artificial islands in the South China Sea.',
      rawSourceDescription: "From the VICE archives: this 2016 documentary investigates China's island-building program.",
    })).toContain('C4')
  })

  it('flags overstated confidence labels deterministically (C6)', () => {
    // Corroborated needs 5+ outlets, or 3+ with a Tier 1-5 source
    expect(failedIds({ ...base, confidenceLabel: 'Corroborated', sourceTier: 5, coverageCount: 1 })).toContain('C6')
    expect(failedIds({ ...base, confidenceLabel: 'Corroborated', sourceTier: 7, coverageCount: 4 })).toContain('C6')
    expect(failedIds({ ...base, confidenceLabel: 'Corroborated', sourceTier: 5, coverageCount: 3 })).not.toContain('C6')
    expect(failedIds({ ...base, confidenceLabel: 'Corroborated', sourceTier: 7, coverageCount: 5 })).not.toContain('C6')
    // Reported requires an institutional Tier 1-6 source
    expect(failedIds({ ...base, confidenceLabel: 'Reported', sourceTier: 7, coverageCount: 0 })).toContain('C6')
    expect(failedIds({ ...base, confidenceLabel: 'Reported', sourceTier: 6, coverageCount: 0 })).not.toContain('C6')
    // Developing requires 2+ outlets for Tier 7-10
    expect(failedIds({ ...base, confidenceLabel: 'Developing', sourceTier: 9, coverageCount: 1 })).toContain('C6')
    expect(failedIds({ ...base, confidenceLabel: 'Developing', sourceTier: 9, coverageCount: 2 })).not.toContain('C6')
    // Conservative labels never fail: Single-source is always the safe floor
    expect(failedIds({ ...base, confidenceLabel: 'Single-source', sourceTier: 3, coverageCount: 4 })).not.toContain('C6')
    // Unknown tier — leave to the model
    expect(failedIds({ ...base, confidenceLabel: 'Reported', sourceTier: null, coverageCount: 0 })).not.toContain('C6')
  })

  it('normalizes self-contradictory C6 failures that conclude the label is correct', async () => {
    anthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          story_id: 'static-test',
          verdict: 'HOLD',
          checks: [
            { id: 'C6', result: 'fail', reason: "Reported is still the correct label for a Tier 3 source with coverage_count: 1 — this is a pass. Label is correct." },
          ],
          revised_headline: null,
          revised_summary: null,
          routing_note: null,
        }),
      }],
    })

    const result = await runQCGate(base, 'test-key')

    expect(result.verdict).toBe('PASS')
    expect(result.checks).toEqual([
      expect.objectContaining({ id: 'C6', result: 'pass' }),
    ])
  })

  it('turns fixable C7 holds with revised copy into FIX verdicts', async () => {
    anthropicCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          story_id: 'static-test',
          verdict: 'HOLD',
          checks: [
            { id: 'C7', result: 'fail', reason: "The summary omits a material headline claim, but the source data supports adding it." },
          ],
          revised_headline: null,
          revised_summary: 'Germany approved what WION describes as the world\'s first cannabis-derived medicine specifically designed to treat chronic pain.',
          routing_note: null,
        }),
      }],
    })

    const result = await runQCGate(base, 'test-key')

    expect(result.verdict).toBe('FIX')
    expect(result.revisedSummary).toContain("world's first")
  })
})
