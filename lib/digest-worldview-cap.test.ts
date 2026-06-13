import { describe, expect, it } from 'vitest'
import { enforceWorldViewCap, enforceBlindspotCap, type DigestContent } from './digest'

const entry = (summary: string) => ({ region: 'DW News', slug: 'youtube-x', summary })

function contentWith(summaries: string[][]): DigestContent {
  return {
    needToKnow: summaries.map((s, i) => ({
      sectionTitle: `Story ${i}`,
      slug: `slug-${i}`,
      paragraphs: ['a', 'b'],
      ...(s.length ? { howWorldSeesIt: s.map(entry) } : {}),
    })),
    inTheKnow: {},
    etcetera: [],
  } as unknown as DigestContent
}

const thirtyWords = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')
const fortyFiveWords = Array.from({ length: 45 }, (_, i) => `w${i}`).join(' ')

describe('enforceWorldViewCap (blocking QC)', () => {
  it('drops the World view section when any entry exceeds 40 words — story survives', () => {
    const content = contentWith([[thirtyWords, fortyFiveWords]])
    const dropped = enforceWorldViewCap(content)
    expect(dropped).toEqual(['slug-0'])
    expect(content.needToKnow[0].howWorldSeesIt).toBeUndefined()
    // the story itself is untouched
    expect(content.needToKnow[0].paragraphs).toHaveLength(2)
  })

  it('keeps compliant sections intact', () => {
    const content = contentWith([[thirtyWords], []])
    const dropped = enforceWorldViewCap(content)
    expect(dropped).toEqual([])
    expect(content.needToKnow[0].howWorldSeesIt).toHaveLength(1)
  })
})

const seventyWords = Array.from({ length: 70 }, (_, i) => `w${i}`).join(' ')
const eightyWords = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ')

describe('enforceBlindspotCap (blocking QC)', () => {
  it('drops a Global Blindspot entry over 70 words, keeps the rest', () => {
    const content = {
      needToKnow: [], inTheKnow: {}, etcetera: [],
      globalBlindspots: [
        { slug: 'keep', region: 'DW News', title: 't', summary: seventyWords },
        { slug: 'drop', region: 'France 24', title: 't', summary: eightyWords },
      ],
    } as unknown as DigestContent
    const dropped = enforceBlindspotCap(content)
    expect(dropped).toEqual(['drop'])
    expect(content.globalBlindspots!.map(i => i.slug)).toEqual(['keep'])
  })
})
