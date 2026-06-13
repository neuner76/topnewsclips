import { getLatestDigest } from '@/lib/digest'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import WorldMapSection from '@/components/WorldMapSection'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Top News Clips, The Full Picture, Not the Profitable Picture',
  description: 'Free daily briefing. Every source labeled by source tier. International context. Global Blindspot. No agenda.',
}

const FEATURES = [
  { icon: '🔬', label: 'Every source labeled by tier', detail: 'Nonprofit investigative, public broadcaster, wire service, commentary — you always know what you\'re reading.' },
  { icon: '✓', label: 'Confidence on every claim', detail: 'Corroborated, reported, analysis, or single-source — so you know how much weight to give each story.' },
  { icon: '🌍', label: 'Global Blindspot', detail: 'Stories with wide international coverage that major US outlets are skipping.' },
  { icon: '🌐', label: 'Global Lens', detail: 'How outlets in Europe, Asia, and the Middle East are covering the same events differently.' },
  { icon: '⚠️', label: 'Limited coverage alerts', detail: 'When fewer than 3 of 15 major outlets have touched a story, we flag it.' },
  { icon: '🎛️', label: 'Tune your briefing', detail: 'After you subscribe, choose topics, regions, sections, and custom interests to surface more of what matters to you.' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const digest = await getLatestDigest()

  // Fetch actual stories for the NeedToKnow digest preview
  let needToKnowStories: Story[] = []
  if (digest?.content.needToKnow?.length) {
    const slugs = digest.content.needToKnow.map(i => i.slug).filter(Boolean)
    if (slugs.length) {
      const { data } = await supabase.from('stories').select('*').in('slug', slugs)
      if (data) {
        const map = new Map((data as Story[]).map(s => [s.slug, s]))
        needToKnowStories = slugs.map(slug => map.get(slug)).filter((s): s is Story => !!s)
      }
    }
  }

  return (
    <>
      <Header />
      <main>

        {/* Hero */}
        <section className="relative overflow-hidden py-20 px-4 sm:px-6" style={{ minHeight: 480 }}>
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
            <p className="text-base sm:text-lg text-white/60 mb-8 max-w-lg mx-auto leading-relaxed">
              Every source labeled by source tier. International context every morning. Undercovered stories surfaced daily, with preferences you can tune after subscribing.
            </p>
            <div className="max-w-sm mx-auto mb-3">
              <EmailCaptureInline placement="landing-hero" />
            </div>
            <p className="text-xs text-white/45 mb-5">
              Not ready to sign up?{' '}
              <Link href="/digest" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
                See a sample issue
              </Link>{' '}first.
            </p>
            <Link href="/feed" className="text-sm text-white/40 hover:text-white/70 transition-colors">
              Browse today&apos;s feed without subscribing →
            </Link>
          </div>
        </section>

        <div className="max-w-2xl mx-auto px-4 sm:px-6">

          {/* Start here — orientation for first-time visitors */}
          <div className="rounded-2xl px-6 py-6 sm:px-8 mb-8" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-3 text-white/45">👋 New here? Start here</span>
            <ol className="space-y-3">
              {[
                { n: '1', t: 'Read the briefing', d: <>Each morning we surface the day&apos;s most important under-covered stories — start with <Link href="/feed" className="text-white/70 hover:text-white underline underline-offset-2">today&apos;s feed</Link>.</> },
                { n: '2', t: 'Check the labels', d: <>Every story shows a <Link href="/taxonomy" className="text-white/70 hover:text-white underline underline-offset-2">source tier</Link> and a confidence label, so you always know how much weight to give it.</> },
                { n: '3', t: 'See how it’s made', d: <>The whole pipeline is public — <Link href="/how-it-works" className="text-white/70 hover:text-white underline underline-offset-2">how it works</Link>, from broad intake to finished digest.</> },
              ].map(s => (
                <li key={s.n} className="flex gap-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 mt-0.5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold">{s.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.t}</p>
                    <p className="text-xs text-white/55 mt-0.5 leading-relaxed">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Today's digest preview — actual stories */}
          {needToKnowStories.length > 0 && (
            <WorldMapSection
              title="Need To Know"
              icon="📌"
              accent="#3b82f6"
              subtitle="Today's most important stories"
              stories={needToKnowStories}
              seeAllHref="/feed"
            />
          )}

          {/* What you get */}
          <div
            className="relative rounded-2xl overflow-hidden mb-8"
            style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(ellipse at 70% 40%, rgba(20,184,166,0.12) 0%, transparent 60%),
                  linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 48px 48px, 48px 48px',
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#14b8a6' }} />
            <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
              <span className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-2 text-[#14b8a6]">🔍 What you get every morning</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-6">Built for readers who want more than headlines</h2>
              <ul className="space-y-4">
                {FEATURES.map(f => (
                  <li key={f.label} className="flex gap-3 rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: '3px solid #14b8a6' }}>
                    <span className="text-lg shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.label}</p>
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Final CTA */}
          <div
            className="relative rounded-2xl overflow-hidden mb-16"
            style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#f97316' }} />
            <div className="relative z-10 px-6 py-10 sm:px-8 text-center">
              <p className="text-2xl font-black text-white mb-2">Free. Daily. No agenda.</p>
              <p className="text-sm text-white/50 mb-6">Get the morning briefing, then tune it around the topics, regions, and industries you follow.</p>
              <div className="max-w-sm mx-auto">
                <EmailCaptureInline placement="landing-bottom" />
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  )
}
