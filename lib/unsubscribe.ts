import { randomBytes } from 'crypto'

export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString('base64url')
}

export function unsubscribeLink(siteUrl: string, token: string): string {
  return `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`
}
