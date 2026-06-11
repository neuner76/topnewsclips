import { describe, expect, it } from 'vitest'
import { runStaticQCChecks, type QCInput } from './qc-gate'

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
})
