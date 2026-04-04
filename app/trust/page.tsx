import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Why Trust This — Top News Clips',
  description: 'You should trust a news product only to the degree that its method deserves trust. Here\'s what earns trust at Top News Clips — and what we don\'t claim.',
  alternates: { canonical: 'https://www.topnewsclips.com/trust' },
  openGraph: {
    title: 'Why Trust This — Top News Clips',
    description: 'You should trust a news product only to the degree that its method deserves trust. Here\'s what earns trust at Top News Clips.',
    url: 'https://www.topnewsclips.com/trust',
  },
  twitter: {
    card: 'summary',
    title: 'Why Trust This — Top News Clips',
    description: 'You should trust a news product only to the degree that its method deserves trust.',
    site: '@topnewsclips',
  },
}

const TRUST_POINTS = [
  {
    title: 'Published source taxonomy',
    body: 'Every source is classified into one of 10 tiers — from nonprofit investigative to community sourced. The taxonomy is public. You can read the methodology. You can dispute any rating.',
    link: { href: '/taxonomy', label: 'See the taxonomy →' },
  },
  {
    title: 'Visible coverage measurement',
    body: 'When we say a story is underreported, we show you exactly how many of the 15 major outlets we monitor have covered it. The number is on the story.',
    link: null,
  },
  {
    title: 'Multiple models, not one',
    body: 'Different AI models have different strengths and blind spots. Pressure-testing across systems reduces single-point bias.',
    link: null,
  },
  {
    title: 'Source labels on every story',
    body: 'You always see who produced the content and what kind of outlet they are. Nothing is anonymous.',
    link: null,
  },
  {
    title: 'Global perspective by default',
    body: 'We don\'t just show you what US media is covering. We show you what the rest of the world is covering that US media isn\'t — and how international outlets frame the stories that both are covering.',
    link: null,
  },
  {
    title: 'Mainstream comparison built in',
    body: 'Mainstream Pulse shows you what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with — so you can see what\'s getting attention and calibrate accordingly.',
    link: null,
  },
  {
    title: 'The system is iterative',
    body: 'We are not pretending this is perfect. The taxonomy is reviewed quarterly. We publish corrections. We are committed to getting better in public.',
    link: { href: '/corrections', label: 'Submit a correction →' },
  },
]

const DONT_CLAIM = [
  {
    title: 'We do not claim that AI is the source of truth.',
    body: 'AI is part of the process — it helps us review, compare, challenge, and synthesize at scale. But truth is pursued through evidence, source quality, corroboration, transparent standards, and continuous refinement.',
  },
  {
    title: 'We do not claim to be unbiased.',
    body: 'We claim to be transparent about our sources, our methods, and our limitations — and to let you evaluate accordingly.',
  },
  {
    title: 'We do not claim to replace journalism.',
    body: 'We surface, classify, and contextualize the journalism that already exists — especially the journalism that isn\'t getting the attention it deserves.',
  },
]

export default function TrustPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}Why Trust This
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Why Trust This</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            You should not trust a news product because it sounds confident.
            You should trust it only to the degree that its method deserves trust.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            That is our view too.
          </p>
        </div>

        <div className="text-[15px] leading-relaxed space-y-10">

          <div className="space-y-3">
            <p>
              Top News Clips is built around a transparent process: broad intake from sources across
              10 published credibility tiers, careful filtering, source-aware evaluation, coverage
              measurement against 15 named mainstream outlets, and multiple AI models challenging
              one another before anything reaches readers.
            </p>
            <p>
              We are not asking you to trust a black box.
              We are showing you the box, how it works, and where every piece comes from.
            </p>
          </div>

          {/* What earns trust */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-6">What earns trust here</h2>
            <div className="space-y-6">
              {TRUST_POINTS.map(({ title, body, link }) => (
                <div key={title} className="border-l-2 border-[oklch(0.52_0.14_196)] pl-4">
                  <p className="font-bold mb-1">{title}</p>
                  <p className="text-muted-foreground text-sm">{body}</p>
                  {link && (
                    <Link href={link.href} className="inline-block mt-2 text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* What we don't claim */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-6">What we do not claim</h2>
            <div className="space-y-5">
              {DONT_CLAIM.map(({ title, body }) => (
                <div key={title}>
                  <p className="font-semibold mb-1">{title}</p>
                  <p className="text-muted-foreground text-sm">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-4 text-sm pt-4 border-t border-border">
            <Link href="/how-it-works" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
              See how it works →
            </Link>
            <Link href="/taxonomy" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
              Source taxonomy →
            </Link>
            <Link href="/corrections" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
              Submit a correction →
            </Link>
          </div>

        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
