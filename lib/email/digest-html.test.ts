import { describe, expect, it } from 'vitest'
import { renderLeadNoticeBanner, buildEmailHtml } from './digest-html'
import type { Story } from '@/lib/types'

describe('renderLeadNoticeBanner', () => {
  it('renders nothing when there is no notice', () => {
    expect(renderLeadNoticeBanner(undefined)).toBe('')
  })

  it('renders the degraded message and the failed gates when present', () => {
    const html = renderLeadNoticeBanner({
      message: 'Lead chosen under degraded eligibility — no fully eligible story today.',
      failedGates: ['Single-source story cannot lead without editorial override.'],
    })
    expect(html).toContain('degraded eligibility')
    expect(html).toContain('Single-source story cannot lead')
  })

  it('escapes HTML in gate reasons to avoid breaking the email markup', () => {
    const html = renderLeadNoticeBanner({
      message: 'Lead chosen under degraded eligibility — no fully eligible story today.',
      failedGates: ['reason with <script>alert(1)</script> & ampersand'],
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; ampersand')
  })
})

describe('buildEmailHtml — Need To Know card ordering', () => {
  const content = {
    needToKnow: [{ slug: 's1', sectionTitle: 'Test Headline Here', paragraphs: ['What happened body.', 'Why it matters body.'] }],
    inTheKnow: {}, globalBlindspots: [], globalLens: [], etcetera: [], mainstreamPulse: [],
  } as unknown as Parameters<typeof buildEmailHtml>[0]
  const story = {
    id: 's1', slug: 's1', title: 'Test Headline Here', description: 'd', category: 'reported',
    journalist_username: 'theintercept', source: 'The Intercept', source_tier: 5, source_type: 'independent_news',
    msm_gap: false, msm_outlet_coverage: { covered: ['a', 'b', 'c', 'd', 'e'], notCovered: [] },
    region: null, created_at: '2026-10-23T10:00:00Z',
  } as unknown as Story
  const storyMap = new Map<string, Story>([['s1', story]])

  it('renders the headline BEFORE the source/metadata badges (headline-first)', () => {
    const html = buildEmailHtml(content, '2026-10-23', 'https://example.com', storyMap)
    const headlineIdx = html.indexOf('Test Headline Here')
    const badgeIdx = html.indexOf('@theintercept')
    expect(headlineIdx).toBeGreaterThan(-1)
    expect(badgeIdx).toBeGreaterThan(-1)
    expect(headlineIdx).toBeLessThan(badgeIdx)
  })
})
