import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'

import { preferenceLink, signPreferenceToken, verifyPreferenceToken } from './preference-tokens'

const SECRET = 'test-preference-secret'

function signedToken(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', SECRET).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

describe('preference tokens', () => {
  process.env.PREFERENCE_TOKEN_SECRET = SECRET

  it('round-trips a signed subscriber token', () => {
    const token = signPreferenceToken('subscriber-123')

    expect(verifyPreferenceToken(token)).toMatchObject({ subscriberId: 'subscriber-123' })
  })

  it('rejects tampered tokens', () => {
    const token = signPreferenceToken('subscriber-123')
    const [, signature] = token.split('.')
    const tamperedPayload = Buffer.from(JSON.stringify({
      subscriberId: 'attacker-456',
      exp: Math.floor(Date.now() / 1000) + 60,
    })).toString('base64url')
    const tampered = `${tamperedPayload}.${signature}`

    expect(verifyPreferenceToken(tampered)).toBeNull()
  })

  it('rejects expired tokens', () => {
    const token = signedToken({
      subscriberId: 'subscriber-123',
      exp: Math.floor(Date.now() / 1000) - 60,
    })

    expect(verifyPreferenceToken(token)).toBeNull()
  })

  it('builds a preference URL for email links', () => {
    const url = preferenceLink('https://www.topnewsclips.com', 'subscriber-123')

    expect(url).toMatch(/^https:\/\/www\.topnewsclips\.com\/preferences\//)
    expect(verifyPreferenceToken(decodeURIComponent(url.split('/preferences/')[1]))).toMatchObject({
      subscriberId: 'subscriber-123',
    })
  })
})
