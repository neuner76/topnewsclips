import Link from 'next/link'
import { MARIN_PLACES, type MarinPlace } from '@/lib/local/marin-places'

// Public "pick your neighborhood" page — the shareable entry point for anyone in
// Marin. Selecting a town opens its live, location-scoped briefing at
// /local/share/[slug]. No login; no owner data.
export const dynamic = 'force-static'
export const metadata = { title: 'Your Marin neighborhood — TopNewsClips' }

const REGION_ORDER: MarinPlace['region'][] = ['North Marin', 'Central Marin', 'Southern Marin', 'West Marin']

export default function MarinPickerPage() {
  const byRegion = REGION_ORDER.map(region => ({
    region,
    places: MARIN_PLACES.filter(p => p.region === region),
  })).filter(g => g.places.length > 0)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Your Marin neighborhood</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick your town for a live local briefing — what’s changing nearby, roads &amp; alerts, weather, fire, and local reporting.
        </p>
      </header>

      <div className="space-y-6">
        {byRegion.map(({ region, places }) => (
          <section key={region}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{region}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {places.map(p => (
                <Link
                  key={p.slug}
                  href={`/local/share/${p.slug}`}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:border-foreground/30 hover:text-[#2563EB] transition-colors"
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-[11px] text-muted-foreground">
        Building-permit activity is richest in unincorporated (West &amp; North) Marin; weather, roads, fire, tides, and
        local reporting cover the whole county. Powered by TopNewsClips.
      </p>
    </main>
  )
}
