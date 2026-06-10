import { getLatestDigest, getRecentDigests } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import SectionCard from '@/components/SectionCard'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Top News Clips — The Full Picture, Not the Profitable Picture',
  description:
    'Free daily briefing. Every source labeled by credibility tier. International context. Global Blindspot. No agenda.',
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  })
}

const FEATURES = [
  { icon: '🔬', label: 'Every source labeled by tier', detail: 'Nonprofit investigative, public broadcaster, wire service, commentary — you always know what you\'re reading.' },
  { icon: '✓', label: 'Confidence on every claim', detail: 'Corroborated, reported, analysis, or single-source — so you know how much weight to give each story.' },
  { icon: '🌍', label: 'Global Blindspot', detail: 'Stories with wide international coverage that major US outlets are skipping.' },
  { icon: '🌐', label: 'Global Lens', detail: 'How outlets in Europe, Asia, and the Middle East are covering the same events differently.' },
  { icon: '⚠️', label: 'Limited coverage alerts', detail: 'When fewer than 3 of 15 major outlets have touched a story, we flag it.' },
]

export default async function LandingPage() {
  const [digest, recent] = await Promise.all([
    getLatestDigest(),
    getRecentDigests(5),
  ])

  const pastEditions = digest
    ? recent.filter(d => d.date !== digest.date).slice(0, 4)
    : recent.slice(0, 4)

  return (
    <>
      <Header />
      <main>

        {/* ── Hero ── */}
        <section
          className="relative overflow-hidden py-20 px-4 sm:px-6"
          style={{ minHeight: 480 }}
        >
          {/* CSS globe grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.18) 0%, transparent 60%),
                radial-gradient(ellipse at 20% 80%, rgba(249,115,22,0.08) 0%, transparent 50%),
                linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px),
                linear-gradient(rgba(59,130,246,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59,130,246,0.025) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0f1e] pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#3b82f6] uppercase mb-4">
              Free Daily Briefing
            </p>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-white mb-6">
              The full picture,<br />
              <span style={{ color: '#3b82f6' }}>not the profitable one.</span>
            </h1>
            <p className="text-base sm:text-lg text-white/60 mb-10 max-w-lg mx-auto leading-relaxed">
              Every source labeled by credibility tier. International context every morning. Stories mainstream media skips — surfaced daily.
            </p>
            <div id="subscribe" className="max-w-sm mx-auto mb-6">
              <EmailCaptureInline placement="landing-hero" />
            </div>
            <Link
              href="/feed"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Browse today&apos;s feed →
            </Link>
          </div>
        </section>

        {/* ── Today's digest preview ── */}
        {digest && (
          <section className="px-4 sm:px-6 max-w-2xl mx-auto mb-8">
            <SectionCard accent="#3b82f6">
              <p className="text-[10px] font-bold tracking-[0.15em] text-[#3b82f6] uppercase mb-4">
                📋 Today&apos;s Digest
              </p>
              <div className="space-y-4 mb-5">
                {digest.content.needToKnow.slice(0, 3).map(item => (
                  <div key={item.slug} className="border-l-2 border-[#3b82f6]/40 pl-3">
                    <p className="text-sm font-bold text-white leading-snug">{item.sectionTitle}</p>
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{item.paragraphs[0]}</p>
                  </div>
                ))}
                <p className="text-xs text-white/30">
                  Plus In The Know, Global Lens
                  {digest.content.globalBlindspots?.length ? ', Global Blindspot' : ''}
                  , and more.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/feed"
                  className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: '#3b82f6' }}
                >
                  Read full digest →
                </Link>
                <Link
                  href={`/digest/${digest.date}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Open in new tab
                </Link>
              </div>
            </SectionCard>
          </section>
        )}

        {/* ── What makes this different ── */}
        <section className="px-4 sm:px-6 max-w-2xl mx-auto mb-8">
          <SectionCard accent="#14b8a6">
            <p className="text-[10px] font-bold tracking-[0.15em] text-[#14b8a6] uppercase mb-5">
              🔍 What you get every morning
            </p>
            <ul className="space-y-5">
              {FEATURES.map(f => (
                <li key={f.label} className="flex gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.label}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        {/* ── Past editions ── */}
        {pastEditions.length > 0 && (
          <section className="px-4 sm:px-6 max-w-2xl mx-auto mb-8">
            <SectionCard accent="#94a3b8">
              <p className="text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase mb-4">
                Past editions
              </p>
              <ul>
                {pastEditions.map(d => (
                  <li key={d.date}>
                    <Link
                      href={`/digest/${d.date}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between py-3 border-b border-white/10 last:border-0 group"
                    >
                      <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                        {formatShortDate(d.date)}
                      </span>
                      <span className="text-xs text-white/30 group-hover:text-white/60 transition-colors">
                        Read →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </section>
        )}

        {/* ── Final CTA ── */}
        <section className="px-4 sm:px-6 max-w-2xl mx-auto mb-16">
          <SectionCard accent="#f97316">
            <div className="text-center py-4">
              <p className="text-xl font-black text-white mb-2">Free. Daily. No agenda.</p>
              <p className="text-sm text-white/50 mb-6">Join readers who want the full picture.</p>
              <div className="max-w-sm mx-auto">
                <EmailCaptureInline placement="landing-bottom" />
              </div>
            </div>
          </SectionCard>
        </section>

      </main>
      <Footer />
    </>
  )
}
