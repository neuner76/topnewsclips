import { describe, expect, it } from 'vitest'
import { renderLeadNoticeBanner } from './digest-html'

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
