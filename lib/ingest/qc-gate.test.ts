import { describe, it, expect, beforeAll } from 'vitest'
import { runQCGate, type QCInput } from './qc-gate'

const apiKey = process.env.ANTHROPIC_API_KEY

function failedIds(checks: { id: string; result: string }[]): string[] {
  return checks.filter(c => c.result === 'fail').map(c => c.id)
}

const base: Omit<QCInput, 'storyId' | 'headline' | 'summary' | 'rawSourceDescription'> = {
  section: 'reported',
  contentType: 'reported',
  confidenceLabel: 'Reported',
  sourceName: 'Test Source',
  sourceTier: 5,
  videoPublishDate: null,
  coverageCount: 5,
}

describe('QC gate (rubric C1-C8)', () => {
  beforeAll(() => {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set — required for QC gate test suite')
    }
  })

  it('T1: promo/junk leak in a satire summary fails C1 -> FIX or HOLD', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't1-josh-johnson',
        section: 'comedy',
        contentType: 'satire',
        confidenceLabel: 'Satire',
        sourceTier: 7,
        coverageCount: 0,
        headline: 'Josh Johnson Stand-Up Special',
        summary: "Check out joshjohnsoncomedy.com/tour for tickets! Follow me @joshjohnsoncomedy on every platform. Hit me on them internets — links in bio. Subscribe for more!",
        rawSourceDescription: "Check out joshjohnsoncomedy.com/tour for tickets! Follow me @joshjohnsoncomedy on every platform. Hit me on them internets — links in bio. New special out now, subscribe for more clips every week!",
      },
      apiKey!
    )

    expect(['FIX', 'HOLD']).toContain(result.verdict)
    expect(failedIds(result.checks)).toContain('C1')
  })

  it('T2: unnamed principal who is named in the source fails C2/C3 -> FIX with name inserted', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't2-former-president',
        headline: 'Former President Booed at NBA Finals',
        summary: 'A former U.S. president was booed by the crowd during introductions at the NBA Finals. The reaction reflects ongoing public sentiment under these circumstances.',
        rawSourceDescription: 'BBC reports that former President Barack Obama was loudly booed by fans during player introductions at Game 3 of the NBA Finals in Oklahoma City on Sunday night.',
      },
      apiKey!
    )

    expect(result.verdict).toBe('FIX')
    const failed = failedIds(result.checks)
    expect(failed).toEqual(expect.arrayContaining(['C2']))
    expect(result.revisedHeadline ?? result.revisedSummary).toBeTruthy()
    const revisedText = `${result.revisedHeadline ?? ''} ${result.revisedSummary ?? ''}`
    expect(revisedText).toMatch(/Obama/)
  }, 60000)

  it('T3: undated retrospective in a daily section fails C4 -> FIX framing + routing note', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't3-vice-retrospective',
        section: 'World',
        headline: "China's Island-Building in the South China Sea Reshapes the Region",
        summary: "China has built military installations on artificial islands in the South China Sea, drawing protests from neighboring countries over territorial claims.",
        rawSourceDescription: "From the VICE archives: this 2016 documentary investigates China's island-building program in the South China Sea, filmed during an on-the-ground visit to the disputed Spratly Islands.",
      },
      apiKey!
    )

    expect(['FIX', 'HOLD']).toContain(result.verdict)
    expect(failedIds(result.checks)).toContain('C4')
    if (result.verdict === 'FIX') {
      expect(result.routingNote).toBeTruthy()
    }
  })

  it('T4: a clean, well-attributed story passes with no changes', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't4-screwworm',
        coverageCount: 8,
        headline: 'New World Screwworm Detected in South Texas Cattle, Texas Tribune Reports',
        summary: 'The Texas Tribune reports that the New World screwworm parasite was confirmed in cattle in South Texas for the first time in decades, prompting state agriculture officials to expand livestock inspection checkpoints near the border.',
        rawSourceDescription: 'The Texas Tribune reports that the New World screwworm parasite was confirmed in cattle in South Texas, prompting state agriculture officials to expand livestock inspection checkpoints near the border.',
      },
      apiKey!
    )

    if (result.verdict !== 'PASS') console.log('T4 DEBUG', JSON.stringify(result, null, 2))
    expect(result.verdict).toBe('PASS')
    expect(failedIds(result.checks)).toEqual([])
  })

  it('T5: "Corroborated" label with coverage_count=1 fails C6 -> FIX label', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't5-label-mismatch',
        confidenceLabel: 'Corroborated',
        coverageCount: 1,
        headline: 'Local Officials Confirm Water Contamination at Riverside Plant',
        summary: 'According to a single local news report, officials confirmed elevated contamination levels at the Riverside water treatment plant.',
        rawSourceDescription: 'A local news station reported that city officials confirmed elevated contamination readings at the Riverside water treatment plant. No other outlets have covered the story.',
      },
      apiKey!
    )

    expect(result.verdict).toBe('FIX')
    expect(failedIds(result.checks)).toContain('C6')
  }, 60000)

  it('T6: headline escalates "claims" to "achieves" -> C7 fail -> FIX headline', async () => {
    const result = await runQCGate(
      {
        ...base,
        storyId: 't6-headline-escalation',
        headline: "Startup's New Chip Achieves 10x the Processing Speed of Predecessor",
        summary: "According to BBC, the company's new chip achieves 10x the speed of its predecessor.",
        rawSourceDescription: "BBC reports the company claims its new chip achieves 10x the processing speed of its predecessor, though independent benchmarks have not yet confirmed this.",
      },
      apiKey!
    )

    expect(result.verdict).toBe('FIX')
    expect(failedIds(result.checks)).toContain('C7')
    expect(result.revisedHeadline).toBeTruthy()
    expect(result.revisedHeadline?.toLowerCase()).toMatch(/claim/)
  }, 60000)
})
