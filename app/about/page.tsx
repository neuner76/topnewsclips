import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const revalidate = 3600

export const metadata = {
  title: 'About Top News Clips — Independent News. No Agenda.',
  description: 'Top News Clips surfaces independent journalism, bodycam footage, and stories mainstream media undercovers. Daily briefing for non-partisan Americans who want facts, not spin.',
  alternates: { canonical: 'https://www.topnewsclips.com/about' },
  openGraph: {
    title: 'About Top News Clips — Independent News. No Agenda.',
    description: 'Top News Clips surfaces independent journalism, bodycam footage, and stories mainstream media undercovers.',
    url: 'https://www.topnewsclips.com/about',
  },
  twitter: {
    card: 'summary',
    title: 'About Top News Clips — Independent News. No Agenda.',
    description: 'Top News Clips surfaces independent journalism, bodycam footage, and stories mainstream media undercovers.',
    site: '@topnewsclips',
  },
}

const FAQ = [
  {
    q: 'What is TopNewsClips?',
    a: 'TopNewsClips is a daily news briefing that surfaces independent journalism, bodycam footage, and viral stories that mainstream US media undercovers. It is designed for non-partisan Americans who want factual reporting without a political agenda.',
  },
  {
    q: 'What does "Limited Coverage" mean?',
    a: 'A Limited Coverage badge means fewer than 3 of the 15 major US news outlets we monitor (NYT, WaPo, CNN, BBC, AP, Reuters, Fox, NBC, ABC, CBS, WSJ, Politico, The Hill, USA Today) have covered this story at the time of publication. It signals the story is receiving little mainstream attention — not that it is unverified.',
  },
  {
    q: 'What is a Global Blindspot?',
    a: 'A Global Blindspot is an international news story — a protest, political crisis, natural disaster, or major event outside the US — that the rest of the world is covering but US mainstream media is ignoring. TopNewsClips surfaces these via its Global Lens feature.',
  },
  {
    q: 'How does TopNewsClips verify stories?',
    a: 'Every story goes through an automated verification pipeline. It cross-references mainstream media coverage to confirm the event is real, checks for AI-generated content risk, and assigns a confidence score. Stories covered by fewer than 3 of our 15 monitored outlets receive a Limited Coverage badge.',
  },
  {
    q: 'Is TopNewsClips biased?',
    a: 'TopNewsClips does not take a political side. Stories are rejected if they only resonate with one partisan tribe. The editorial standard is: corporate corruption, government overreach, institutional failure, and police accountability are American issues — not left or right issues.',
  },
  {
    q: 'What types of content does TopNewsClips publish?',
    a: 'Every story carries a Source Credibility badge — a 10-tier classification so readers can evaluate the source, not just the headline. Tier 1 is Nonprofit Investigative (ProPublica, Marshall Project), Tier 3 is Public Broadcaster (DW, Al Jazeera, PBS), Tier 7 is Independent Commentary (analysts and explainers), down to Tier 10 Community Sourced (Reddit footage). Stories are also labeled by content type: Footage (bodycam, dashcam, bystander video), Investigation (reported journalism from known journalists), Report (wire, press, institutional), or Commentary (analysis, explainers, opinion). See the full taxonomy at topnewsclips.com/taxonomy.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-10 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">About</h1>
          <p className="text-sm text-muted-foreground">
            What mainstream media misses. What the world is watching. In 5 minutes.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">What we do</h2>
            <p>
              TopNewsClips is a daily briefing that keeps Americans genuinely informed — without
              the noise, the outrage bait, or the partisan frame. We do four things:
            </p>
            <ul className="mt-4 space-y-4 list-none pl-0">
              {[
                { label: 'Surface what mainstream media is underreporting', body: 'Credible, verified stories that fewer than 3 of the 15 major US outlets are covering. Real events. Just not getting airtime.' },
                { label: 'Cover what the world is watching that US media ignores', body: 'International protests, crises, and events the rest of the world considers major news — and US outlets have skipped.' },
                { label: 'Show how the world frames today\'s biggest stories', body: 'The same story looks different from Seoul, London, or Lagos. We surface those perspectives so you understand the full picture.' },
                { label: 'Make the news digestible so you can get on with your day', body: 'One daily briefing. Verified. Curated. You read it in 5 minutes and you\'re done — informed, not anxious.' },
              ].map(({ label, body }, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[oklch(0.52_0.14_196)] shrink-0 font-black text-lg leading-snug">{i + 1}.</span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-muted-foreground text-sm mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Our editorial standard</h2>
            <p>
              If a story only resonates with one side, it probably doesn&apos;t belong here. We curate
              for the citizen who wants to understand what&apos;s actually happening — not for the
              partisan who wants confirmation of what they already believe.
            </p>
            <p className="mt-3">
              Corporate corruption, government overreach, institutional failure, scientific breakthroughs,
              police accountability — these aren&apos;t left issues or right issues. They&apos;re
              American issues. That&apos;s the lens we apply.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How verification works</h2>
            <p>
              Every piece of content goes through an automated verification pipeline before it goes live.
              We cross-reference mainstream media coverage to confirm events are real, filter out
              entertainment and foreign news, and flag stories with an{' '}
              <span className="font-semibold">Limited Coverage</span> badge when fewer than 3 of the
              15 major outlets we monitor have covered a story — meaning it&apos;s receiving little mainstream attention.
            </p>
            <p className="mt-3">
              We&apos;re not perfect. If you see something that shouldn&apos;t be here, or something
              important we&apos;re missing, reach out.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">The daily digest</h2>
            <p>
              Each morning we publish a briefing from the day&apos;s best stories — written the way
              a smart, non-partisan friend would explain the news: what happened, who it affects,
              and why it matters to your life. No spin. No outrage. Just facts and context.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
            >
              Read today&apos;s digest →
            </Link>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How we&apos;re funded</h2>
            <p>
              TopNewsClips is independently operated and funded by its founder. We have no investors,
              no advertisers, and no institutional backing. Revenue comes from voluntary email subscriptions.
              That&apos;s it. No one is paying us to cover — or not cover — any story.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Corrections</h2>
            <p>
              We&apos;re not perfect. If a story is mislabeled, a summary overstates the source material,
              or a tier badge is wrong, we want to know. Email us at{' '}
              <Link href="/contact" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
                the contact page
              </Link>{' '}
              with the story URL and the specific issue. Confirmed corrections are applied within 24 hours.
              We don&apos;t memory-hole mistakes — if a summary was editorially out of bounds, we&apos;ll
              note it was updated.
            </p>
          </section>

          {/* FAQ — structured for AI extraction */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-6">Frequently asked questions</h2>
            <dl className="space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="border-b border-border pb-6 last:border-0 last:pb-0">
                  <dt className="font-bold text-[15px] mb-2">{q}</dt>
                  <dd className="text-muted-foreground leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
