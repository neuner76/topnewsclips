import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — Top News Clips',
  description: 'Frequently asked questions about Top News Clips — what it is, how it works, how sources are classified, and how it\'s funded.',
  alternates: { canonical: 'https://www.topnewsclips.com/faq' },
  openGraph: {
    title: 'FAQ — Top News Clips',
    description: 'Frequently asked questions about Top News Clips.',
    url: 'https://www.topnewsclips.com/faq',
  },
  twitter: {
    card: 'summary',
    title: 'FAQ — Top News Clips',
    description: 'Frequently asked questions about Top News Clips.',
    site: '@topnewsclips',
  },
}

const FAQ = [
  {
    q: 'What is Top News Clips?',
    a: 'A daily news briefing that surfaces verified stories mainstream US media is underreporting, shows how the rest of the world covers today\'s events, and labels every source by credibility tier — so you can get the full picture in 5 minutes.',
  },
  {
    q: 'Is it a traditional newsroom?',
    a: 'No. We do not produce original reporting. We surface, classify, and contextualize journalism from over 50 sources across 10 credibility tiers — from nonprofit investigative newsrooms like ProPublica to public broadcasters like DW News to independent commentators and raw footage.',
  },
  {
    q: 'What does "Limited Coverage" mean?',
    a: 'It means fewer than 3 of the 15 major US news outlets we monitor have covered this story at the time of publication. The exact count is displayed on the story. It signals that the story is receiving little mainstream attention — not that it is unverified.',
  },
  {
    q: 'What is a Global Blindspot?',
    a: 'An international news story that the rest of the world considers significant — a protest, a policy shift, a humanitarian crisis — but that US mainstream media has largely skipped.',
  },
  {
    q: 'What is Global Lens?',
    a: 'A section showing how international outlets are framing the same stories US media is also covering. Same event, different perspective — so you can see what a single country\'s newsroom can\'t show you.',
  },
  {
    q: 'What is Mainstream Pulse?',
    a: 'A side-by-side view of what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with today — spanning public media to conservative media. Ten seconds to see the full mainstream spectrum.',
  },
  {
    q: 'How are sources classified?',
    a: 'Every source is assigned to one of 10 credibility tiers in our published Source Credibility Taxonomy. Tiers range from Tier 1 (nonprofit investigative newsrooms) to Tier 10 (unverified community content). The full methodology is at topnewsclips.com/taxonomy.',
  },
  {
    q: 'Does AI decide what is true?',
    a: 'No. AI helps us process, compare, challenge, and synthesize information at scale. It does not replace evidence, source quality, or editorial judgment.',
  },
  {
    q: 'Why use multiple AI models?',
    a: 'Because one model can be smart and still be incomplete or overconfident. Multiple models reduce single-system bias.',
  },
  {
    q: 'Is Top News Clips biased?',
    a: 'We don\'t claim to be unbiased. We claim to be transparent. Every source is labeled. Every coverage gap is measured. Our methodology is published. If a story only resonates with one political tribe, it probably doesn\'t belong here.',
  },
  {
    q: 'How is Top News Clips funded?',
    a: 'Independently. Top News Clips is operated and funded by its founder, Eric Neuner. No investors. No advertisers. No institutional backing. Revenue comes from voluntary subscriptions. No one is paying us to cover — or not cover — any story.',
  },
  {
    q: 'Who founded Top News Clips?',
    a: 'Eric Neuner, an entrepreneur and systems-minded builder based in Northern California.',
  },
  {
    q: 'Is the system perfect?',
    a: 'No. It is serious, iterative, and improving. The taxonomy is reviewed quarterly. We publish corrections. We want to hear when we get something wrong.',
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

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}FAQ
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">FAQ</h1>
          <p className="text-sm text-muted-foreground">Frequently asked questions about Top News Clips.</p>
        </div>

        <dl className="space-y-6 text-[15px]">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="border-b border-border pb-6 last:border-0 last:pb-0">
              <dt className="font-bold mb-2">{q}</dt>
              <dd className="text-muted-foreground leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap gap-4 text-sm border-t border-border pt-6">
          <Link href="/how-it-works" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            How it works →
          </Link>
          <Link href="/trust" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            Why trust this →
          </Link>
          <Link href="/taxonomy" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            Source taxonomy →
          </Link>
          <Link href="/corrections" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            Submit a correction →
          </Link>
        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
