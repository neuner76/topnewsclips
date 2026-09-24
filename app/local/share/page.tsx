import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[780px] px-4 py-8 sm:px-6 text-foreground">
        <header className="mb-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">📍 Local Briefing</p>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">Your Marin neighborhood</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pick your town for a live local briefing — what’s changing nearby, roads &amp; alerts, weather, fire, and local reporting.
          </p>
        </header>

        <div className="space-y-7">
          {byRegion.map(({ region, places }) => (
            <section key={region}>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">{region}</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {places.map(p => (
                  <Link
                    key={p.slug}
                    href={`/local/share/${p.slug}`}
                    className="rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-[12px] leading-relaxed text-muted-foreground">
          Tip: jump straight to your area by ZIP or name — e.g.{' '}
          <span className="font-mono text-foreground">/local/share/94940</span> or{' '}
          <span className="font-mono text-foreground">/local/share/point-reyes-station</span>.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Building-permit activity is richest in unincorporated (West &amp; North) Marin; weather, roads, fire, tides, and
          local reporting cover the whole county.
        </p>
      </main>
      <Footer />
    </div>
  )
}
