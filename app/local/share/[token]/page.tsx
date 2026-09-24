import { buildMyLocalDigest, type MyLocalDigest } from '@/lib/local/digest'
import { decodeShareToken, type ShareLocation } from '@/lib/local/share'
import { findMarinPlace } from '@/lib/local/marin-places'
import { LocalDigestView } from '../../LocalDigestView'

// PUBLIC, link-only share of a location-scoped local briefing. No owner login,
// and it never reads or exposes the owner's saved places — the token carries its
// own location. LLM extraction is skipped in shared mode (see buildMyLocalDigest)
// so public traffic can't spend the owner's API key.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Local briefing — TopNewsClips' }

export default async function SharedLocalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Accept either an opaque share token OR a readable Marin town slug, so the
  // URL is human-editable — swap "marshall" for "bolinas" and it just works.
  let loc: ShareLocation | null = decodeShareToken(token)
  if (!loc) {
    const place = findMarinPlace(token)
    if (place) loc = { lat: place.lat, lng: place.lng, label: place.label, radiusMiles: place.radiusMiles }
  }

  if (!loc) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">
          This link isn’t a place we recognize.{' '}
          <a href="/local/share" className="text-[#2563EB] hover:underline">Pick your Marin town →</a>
        </p>
      </main>
    )
  }

  let digest: MyLocalDigest
  try {
    digest = await buildMyLocalDigest({
      point: { lat: loc.lat, lng: loc.lng },
      anchors: [{ lat: loc.lat, lng: loc.lng, radiusMiles: loc.radiusMiles, label: loc.label }],
      coverageAreas: [loc.label],
    })
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm text-red-600">This briefing is temporarily unavailable.</p>
      </main>
    )
  }

  return (
    <LocalDigestView
      digest={digest}
      heading={`Local — ${loc.label}`}
      subheading={`A live local briefing centered on ${loc.label}.`}
      note={
        <p className="mt-2 inline-block rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          Shared with you · powered by TopNewsClips
        </p>
      }
    />
  )
}
