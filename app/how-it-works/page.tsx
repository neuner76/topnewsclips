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
    body: 'The pipeline removes duplicates and filters out:',
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
            Top News Clips uses a multi-stage, multi-model process guided by published standards to produce
            each daily briefing.
          </p>
          <p className="text-sm text-muted-foreground mt-3 italic">
            The trust isn&apos;t &ldquo;the AI said so.&rdquo; It comes from the process: source labels,
            confidence labels, public methodology, coverage measurement, and multiple systems checking
            the work before publication.
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

        {/* Annotated example */}
        <div className="mt-12 border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-5 py-3 border-b border-border">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Example: How a story reaches your briefing</p>
          </div>
          <div className="px-5 py-4 space-y-4 text-[14px]">
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 1 — Source identified</p>
              <p>Channel: <span className="font-semibold">@60minutes</span> — Tier 6 (Commercial Newsroom)</p>
              <p className="text-muted-foreground">Published: April 4, 2026</p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 2 — Coverage check</p>
              <p>Checked against 15 major US outlets. Result: <span className="font-semibold">0 of 15</span> had covered this story at publication time.</p>
              <p className="text-muted-foreground mt-0.5">→ Flagged as Limited Coverage.</p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 3 — Content classification</p>
              <p>Type: <span className="font-semibold">Reported</span> — original field journalism with named sources.</p>
              <p className="text-muted-foreground mt-0.5">Not commentary. Not raw footage. Not promotional.</p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 4 — Verification</p>
              <p>A second AI model challenges the classification, checks the financial figures, and flags anything that can&apos;t be corroborated. If confidence is below threshold, the story is held for human review rather than published.</p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 5 — Placement decision</p>
              <p>Assigned to: <span className="font-semibold">Science &amp; Technology</span></p>
              <p className="text-muted-foreground mt-0.5">Rationale: primary significance is the engineering innovation, not the geopolitics.</p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Step 6 — Summary written</p>
              <p>Attribution-forward voice. &ldquo;60 Minutes reports that...&rdquo; No editorial conclusions beyond what the source documents.</p>
            </div>
            <div className="bg-muted/50 rounded p-3 text-sm">
              <p className="font-semibold mb-1">Result: story appears in today&apos;s briefing with:</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>– Tier 6 badge (Commercial Newsroom)</li>
                <li>– @60minutes handle</li>
                <li>– &ldquo;0 of 15 outlets&rdquo; coverage count</li>
                <li>– Neutral, source-attributed summary</li>
              </ul>
            </div>
          </div>
        </div>

        {/* How Stories Are Selected */}
        <div id="selection" className="mt-12 border-t-2 border-[oklch(0.52_0.14_196)] pt-8">
          <h2 className="text-xl font-black tracking-tight mb-2">How Stories Are Selected</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A story qualifies for the daily briefing when it meets at least one of these criteria.
          </p>
          <div className="space-y-4 text-[14px]">
            {[
              {
                label: 'Public consequence',
                body: 'The development directly affects government policy, public spending, civil rights, public health, or institutional accountability.',
              },
              {
                label: 'Market or economic impact',
                body: 'The story affects consumer prices, employment, trade, or financial markets in ways that reach ordinary households.',
              },
              {
                label: 'Democratic process',
                body: 'The development involves elections, judicial decisions, legislative action, or government transparency.',
              },
              {
                label: 'Undercovered significance',
                body: 'The story is verified and consequential but receiving limited attention from the 15 major US outlets we monitor.',
              },
              {
                label: 'Global perspective',
                body: 'International coverage reveals a meaningfully different framing of an event also covered in US media, or an event the rest of the world considers significant that US outlets have not covered.',
              },
              {
                label: 'Structural pattern',
                body: 'The story documents a systemic issue — corporate practice, institutional failure, policy gap — rather than a one-time event.',
              },
            ].map(({ label, body }) => (
              <div key={label} className="flex gap-3">
                <span className="shrink-0 text-[oklch(0.52_0.14_196)] font-bold mt-0.5">—</span>
                <p>
                  <span className="font-semibold">{label}</span>
                  {' '}
                  <span className="text-muted-foreground">{body}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-muted-foreground border-t border-border pt-4">
            Stories are <strong>not</strong> included simply because they are viral, dramatic, or emotionally provocative.
            Virality and engagement metrics are tracked but are not inclusion criteria.
          </p>
        </div>

        {/* Short version */}
        <div className="mt-8 p-5 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">Short version</p>
          <p className="text-[15px] leading-relaxed">
            Overnight, the pipeline pulls from 50+ sources across 10 credibility tiers, filters junk,
            classifies every source, checks coverage against 15 mainstream outlets, pressure-tests stories
            with multiple AI models, and assembles a briefing with visible source labels and coverage
            counts — so by morning, you have the full picture in 5 minutes.
          </p>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">Broader context and undercovered stories are surfaced. No doom scroll required.</p>
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
