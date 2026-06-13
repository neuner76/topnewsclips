import { describe, expect, it } from 'vitest'
import { runSectionQC } from './section-qc'

const goodContext = 'According to Reuters, Pakistan conducted airstrikes across the Afghan border on June 12. Afghan authorities said at least 13 people were killed. Officials in Kabul condemned the operation, per AP.'

describe('runSectionQC (blocking section QC)', () => {
  it('passes well-attributed sections through intact', () => {
    const { sections, dropped } = runSectionQC({
      inContext: goodContext,
      whatWeKnow: ['At least 13 people were killed, per Afghan authorities (AP, Reuters).'],
      whatRemainsUnclear: ['Whether the strikes hit military or civilian sites is unconfirmed.'],
      isDeveloping: true,
    })
    expect(sections.inContext).toBe(goodContext)
    expect(sections.whatWeKnow).toHaveLength(1)
    expect(sections.whatRemainsUnclear).toHaveLength(1)
    expect(dropped).toEqual([])
  })

  it('drops an inContext paragraph with an unattributed causal claim', () => {
    const { sections, dropped } = runSectionQC({
      inContext: 'The strikes signal a dramatic escalation because tensions have been rising for weeks.',
      isDeveloping: false,
    })
    expect(sections.inContext).toBeNull()
    expect(dropped).toContain('inContext')
  })

  it('drops whatWeKnow entries that lack attribution', () => {
    const { sections, dropped } = runSectionQC({
      whatWeKnow: ['Thirteen people died in the attack.'], // no source named
      isDeveloping: false,
    })
    expect(sections.whatWeKnow).toBeNull()
    expect(dropped).toContain('whatWeKnow')
  })

  it('fails when a developing story has no whatRemainsUnclear', () => {
    const { sections, dropped } = runSectionQC({
      inContext: goodContext,
      whatRemainsUnclear: null,
      isDeveloping: true,
    })
    expect(sections.whatRemainsUnclear).toBeNull()
    expect(dropped).toContain('whatRemainsUnclear(required)')
  })

  it('allows a settled story to omit whatRemainsUnclear without failing', () => {
    const { dropped } = runSectionQC({
      inContext: goodContext,
      whatRemainsUnclear: null,
      isDeveloping: false,
    })
    expect(dropped).not.toContain('whatRemainsUnclear(required)')
  })

  it('rejects banned escalatory voice even with attribution present', () => {
    const { sections } = runSectionQC({
      inContext: 'Reuters reports the unprecedented purge lays bare the ministry plan.',
      isDeveloping: false,
    })
    expect(sections.inContext).toBeNull()
  })
})
