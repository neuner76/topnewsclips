import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

interface TokenPayload {
  subscriberId: string
  exp: number
}

function secret(): string {
  const value = process.env.PREFERENCE_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error('PREFERENCE_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY is required')
  return value
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function signPreferenceToken(subscriberId: string): string {
  const payload: TokenPayload = {
    subscriberId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const encodedPayload = base64url(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyPreferenceToken(token: string): TokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expected = sign(encodedPayload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload
    if (!payload.subscriberId || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function preferenceLink(siteUrl: string, subscriberId: string): string {
  return `${siteUrl}/preferences/${encodeURIComponent(signPreferenceToken(subscriberId))}`
}
