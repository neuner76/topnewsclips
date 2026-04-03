import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works — Top News Clips',
  description: 'A transparent look at the multi-stage, multi-model AI process Top News Clips uses to produce each daily briefing — from broad intake to finished digest.',
  alternates: { canonical: 'https://www.topnewsclips.com/how-it-works' },
  openGraph: {
    title: 'How It Works — Top News Clips',
    description: 'A transparent look at the multi-stage, multi-model AI process Top News Clips uses to produce each daily briefing.',
    url: 'https://www.topnewsclips.com/how-it-works',
  },
  twitter: {
    card: 'summary',
    title: 'How It Works — Top News Clips',
    description: 'A transparent look at the multi-stage, multi-model AI process Top News Clips uses to produce each daily briefing.',
    site: '@topnewsclips',
  },
}

const STEPS = [
  {
    step: 1,
    title: 'Broad intake',
    body: 'The system starts with a wide pool of sources spanning nonprofit investigative newsrooms, public broadcasters, wire services, independent journalists, open-source intelligence organizations, and commercial news outlets. We pull from over 50 channels across 10 credibility tiers.',
    note: 'A useful briefing starts wide before it gets selective.',
  },
  {
    step: 2,
    title: 'Deduplication and noise filtering',
    body: null,
    note: 'The goal: keep the briefing from becoming a landfill with good typography.',
    list: [
      'repetitive versions of the same story',
      'low-information content',
      'promotional material dressed as journalism',
      'commentary masquerading as reporting',
      'sensational content designed mainly to hijack attention',
    ],
  },
  {
    step: 3,
    title: 'Source classification',
    body: 'Every source is classified using our published 10-tier Source Credibility Taxonomy — from Tier 1 (nonprofit investigative newsrooms like ProPublica and FRONTLINE) through Tier 10 (unverified community-sourced content). The tier travels with the story from pipeline to publication.',
    note: null,
    link: { href: '/taxonomy', label: 'See the full taxonomy →' },
  },
  {
    step: 4,
    title: 'Coverage analysis',
    body: 'The system checks each story against 15 major US news outlets — including NYT, Washington Post, CNN, Fox News, AP, Reuters, BBC, NBC, ABC, CBS, WSJ, Politico, The Hill, NPR, and USA Today. Stories covered by fewer than 3 of those 15 outlets are flagged as Limited Coverage, with the exact count displayed.',
    note: 'This is a measurement, not a conspiracy claim. You decide what to make of it.',
  },
  {
    step: 5,
    title: 'Multi-model challenge',
    body: 'Instead of relying on one AI model, Top News Clips uses multiple models with different strengths and blind spots to review, challenge, and synthesize the strongest candidates.',
    note: 'Think less "oracle." More "a room full of very fast researchers required to check each other\'s work."',
  },
  {
    step: 6,
    title: 'Briefing construction',
    body: 'The system assembles the daily briefing into distinct sections:',
    note: 'Every story carries its source tier badge, source handle, and coverage count.',
    list: [
      'Need To Know — the day\'s most significant underreported stories',
      'In The Know — categorized stories across politics, science, business, and culture',
      'Global Blindspot — international stories US media is ignoring',
      'Global Lens — how international outlets frame stories US media is also covering',
      'Mainstream Pulse — what NPR, NYT, AP, Reuters, WSJ, and Fox News are each leading with, left to right',
    ],
  },
  {
    step: 7,
    title: 'Continuous improvement',
    body: 'This is not a finished monument. It\'s an evolving system. We continuously refine source calibration, filtering quality, summarization accuracy, coverage detection, tier classifications, and editorial proportion. The taxonomy is reviewed quarterly. Sources can shift tiers based on changes to their funding, editorial independence, or track record.',
    note: null,
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}How It Works
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">How It Works</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Top News Clips uses a multi-stage, multi-model AI process combined with a published editorial
            framework to produce each daily briefing.
          </p>
          <p className="text-sm text-muted-foreground mt-3 italic">
            The trust isn&apos;t &ldquo;the AI said so.&rdquo; The trust comes from the process — and from
            showing you how every piece is made.
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed">
          {STEPS.map(({ step, title, body, note, list, link }) => (
            <div key={step} className="border-l-2 border-border pl-5">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0">
                  Step {step}
                </span>
                <h2 className="text-base font-black tracking-tight">{title}</h2>
              </div>
              {body && <p className="text-[15px] text-foreground/90">{body}</p>}
              {list && (
                <ul className="mt-2 space-y-1">
                  {list.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="shrink-0 text-muted-foreground/50">–</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {note && (
                <p className="mt-3 text-sm text-muted-foreground italic">{note}</p>
              )}
              {link && (
                <Link href={link.href} className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
                  {link.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Short version */}
        <div className="mt-12 p-5 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">Short version</p>
          <p className="text-[15px] leading-relaxed">
            Overnight, the pipeline pulls from 50+ sources across 10 credibility tiers, filters junk,
            classifies every source, checks coverage against 15 mainstream outlets, pressure-tests stories
            with multiple AI models, and assembles a briefing with visible source labels and coverage
            counts — so by morning, you have the full picture in 5 minutes.
          </p>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">No doom scroll required.</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/trust" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            Why trust this →
          </Link>
          <Link href="/taxonomy" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            Source taxonomy →
          </Link>
          <Link href="/faq" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
            FAQ →
          </Link>
        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
