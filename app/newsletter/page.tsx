import { getLatestDigest, getRecentDigests } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import Link from 'next/link'
import { NewsletterAnalytics } from '@/components/NewsletterAnalytics'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Daily Briefing | TopNewsClips',
  description:
    'Get the full picture in 5 minutes. Independent news, every source labeled, international context included. Free daily briefing.',
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/New_York',
  })
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  })
}

const FEATURES = [
  {
    label: 'Every source labeled',
    detail:
      "Journalist, public media, investigative, independent — you always know what type of source you're reading.",
  },
  {
    label: 'Confidence on every claim',
    detail:
      'Corroborated, reported, developing, or single-source — so you know how much weight to give each story.',
  },
  {
    label: 'International perspectives',
    detail:
      'How outlets in Europe, Asia, and the Middle East are covering the same events differently from U.S. media.',
  },
  {
    label: 'Global Blindspot',
    detail: 'Stories with wide international coverage that major U.S. outlets are skipping.',
  },
  {
    label: 'Reporting, analysis, and commentary — always distinguished',
    detail:
      'Clear source labels so you know what type of content you are reading, not just who wrote it.',
  },
]

export default async function NewsletterPage() {
  const [digest, recent] = await Promise.all([
    getLatestDigest(),
    getRecentDigests(5),
  ])

  const pastEditions = digest
    ? recent.filter((d) => d.date !== digest.date).slice(0, 3)
    : recent.slice(0, 3)

  return (
    <>
      <Header />
      <NewsletterAnalytics />
      <main>

        {/* Hero */}
        <section className="py-16 px-4 sm:px-6 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase mb-3">
              TopNewsClips Daily Briefing
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
              Get the full picture<br className="hidden sm:block" /> in 5 minutes.
            </h1>
            <p className="text-base text-muted-foreground mb-8 max-w-lg">
              Independent daily briefing. Every source labeled. International context every morning.
            </p>
            <div className="max-w-sm">
              <EmailCaptureInline placement="newsletter-hero" />
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="py-16 px-4 sm:px-6 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-8">
              What you get every morning
            </p>
            <ul className="space-y-6">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex gap-4">
                  <span className="text-[oklch(0.52_0.14_196)] font-bold mt-0.5 shrink-0">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sample preview */}
        {digest && (
          <section className="py-10 px-4 sm:px-6 border-b border-border">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
                Sample edition
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {formatLongDate(digest.date)}
              </p>

              {/* Collapsed preview: first 2 NTK story titles only */}
              <div className="space-y-4 mb-6">
                {digest.content.needToKnow.slice(0, 2).map((item) => (
                  <div key={item.slug} className="border-l-2 border-[oklch(0.52_0.14_196)] pl-3">
                    <p className="text-sm font-bold tracking-tight">{item.sectionTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.paragraphs[0]}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Plus In The Know, Global Lens
                  {digest.content.globalBlindspots?.length ? ', Global Blindspot' : ''}
                  , and more.
                </p>
              </div>

              <Link
                href={`/digest/${digest.date}`}
                className="inline-block text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2"
              >
                Open full sample →
              </Link>

              <div className="mt-10 pt-8 border-t border-border">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Get the full picture in 5 minutes.
                </p>
                <p className="text-xs text-muted-foreground mb-3">Delivered every morning. Free.</p>
                <div className="max-w-sm">
                  <EmailCaptureInline placement="newsletter-after-sample" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Past editions */}
        {pastEditions.length > 0 && (
          <section className="py-10 px-4 sm:px-6 border-b border-border">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6">
                Past editions
              </p>
              <ul>
                {pastEditions.map((d) => (
                  <li key={d.date}>
                    <Link
                      href={`/digest/${d.date}`}
                      className="flex items-center justify-between py-3 border-b border-border/50 group"
                    >
                      <span className="text-sm font-medium group-hover:underline">
                        {formatShortDate(d.date)}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Read →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <EmailCapture />
      </main>
      <Footer />
    </>
  )
}
