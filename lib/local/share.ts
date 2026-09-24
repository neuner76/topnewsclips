// Shareable /local links. A share token encodes a location (point + label +
// radius) so a public, link-only page can render a Marshall-centered (or any
// place's) local briefing WITHOUT the owner's login and WITHOUT touching the
// owner's saved places. Not a secret — it's public geodata — just an opaque,
// non-enumerable blob so the URL is one clean shareable string.

export interface ShareLocation {
  lat: number
  lng: number
  label: string
  radiusMiles: number
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8')
}

export function encodeShareToken(loc: ShareLocation): string {
  // Compact keys keep the token short; round coords to ~11 m precision.
  return b64urlEncode(JSON.stringify({
    la: Number(loc.lat.toFixed(4)),
    ln: Number(loc.lng.toFixed(4)),
    l: loc.label,
    r: loc.radiusMiles,
  }))
}

export function decodeShareToken(token: string): ShareLocation | null {
  try {
    const o = JSON.parse(b64urlDecode(token)) as { la?: unknown; ln?: unknown; l?: unknown; r?: unknown }
    const lat = Number(o.la)
    const lng = Number(o.ln)
    const label = typeof o.l === 'string' ? o.l : ''
    const radiusMiles = Number(o.r)
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null
    if (!Number.isFinite(lng) || Math.abs(lng) > 180) return null
    if (!label) return null
    return { lat, lng, label, radiusMiles: Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 10 }
  } catch {
    return null
  }
}
