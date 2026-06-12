import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Source Credibility Taxonomy | Top News Clips',
  description: 'How Top News Clips classifies every source into a visible credibility tier so readers can instantly calibrate editorial weight.',
  alternates: { canonical: 'https://www.topnewsclips.com/taxonomy' },
  openGraph: {
    title: 'Source Credibility Taxonomy | Top News Clips',
    description: 'How Top News Clips classifies every source into a visible credibility tier.',
    url: 'https://www.topnewsclips.com/taxonomy',
  },
}

const TIERS = [
  {
    tier: 1,
    name: 'Nonprofit Investigative',
    color: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
    definition: '501(c)(3) or equivalent nonprofit newsrooms, donor-funded, with institutional editorial standards and published corrections policies.',
    rationale: 'These organizations exist solely to produce public-interest journalism. No shareholders, no ad revenue pressure, no corporate parent to please. Their accountability comes from transparency with donors and the public.',
    examples: 'ProPublica, Marshall Project, Texas Tribune, CalMatters, FRONTLINE PBS',
    note: null,
  },
  {
    tier: 2,
    name: 'OSINT',
    color: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
    definition: 'Organizations that verify events using satellite imagery, geolocation, social media forensics, and publicly available data. Methods are transparent and reproducible.',
    rationale: 'OSINT carries a different kind of credibility from traditional reporting. Its claims are independently verifiable by anyone with the same tools. This makes it uniquely trustworthy for confirming or debunking events.',
    examples: 'Bellingcat',
    note: null,
  },
  {
    tier: 3,
    name: 'Public Broadcaster',
    color: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
    definition: 'Government-funded but editorially independent by statute or charter. Subject to public accountability mechanisms.',
    rationale: 'Public broadcasters are funded by governments but legally required to maintain editorial independence. They typically have large international correspondent networks and rigorous editorial standards.',
    examples: 'DW News, France 24, NHK World, ABC News Australia, Arirang News',
    note: 'Al Jazeera is funded by Qatar. Editorial independence has been debated, particularly on Gulf affairs. The label "Public Broadcaster" is applied because of its institutional structure and international editorial standards, not as a blanket endorsement.',
  },
  {
    tier: 4,
    name: 'Independent News',
    color: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
    definition: 'Editorially staffed outlets with institutional standards and professional journalists, but not structured as traditional nonprofits or legacy outlets.',
    rationale: 'This tier captures outlets that don\'t fit cleanly into "nonprofit" or "legacy" but maintain newsroom-level editorial processes. They often employ award-winning journalists and operate with editorial independence from commercial pressures.',
    examples: 'The Intercept, Drop Site News, Bureau of Investigative Journalism',
    note: 'The Intercept has a left-leaning editorial perspective and has faced some internal controversies. Drop Site News is new (2024) but staffed by experienced investigative reporters.',
  },
  {
    tier: 5,
    name: 'Wire Service',
    color: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
    definition: 'Global newswire agencies that produce factual dispatches republished by thousands of outlets worldwide. Neutral by design.',
    rationale: 'Wire services are the backbone of factual news. Their dispatches are the raw material other outlets build stories from. They rarely editorialize and maintain among the strictest accuracy standards in journalism.',
    examples: 'Reuters, Associated Press',
    note: null,
  },
  {
    tier: 6,
    name: 'Newsroom',
    color: 'text-white/70 bg-white/10 border-white/15',
    definition: 'Established commercial news outlets and explainer-journalism brands. Ad-supported or subscription-funded with professional editorial teams and institutional editorial standards.',
    rationale: 'These outlets produce quality journalism but operate within commercial media structures. Their editorial decisions can be influenced by audience metrics, advertiser relationships, or corporate ownership, a structural constraint that doesn\'t apply to nonprofits or public broadcasters.',
    examples: 'CNN, ABC News, CBS News, CNBC, BBC News, 60 Minutes, Dateline NBC, Vox, Bloomberg Quicktake, Journeyman Pictures',
    note: null,
  },
  {
    tier: 7,
    name: 'Independent Commentary',
    color: 'text-white/70 bg-white/10 border-white/15',
    definition: 'Individual journalists, creator-led channels, and non-institutional commentary. Editorial accountability rests with the creator, not an institution.',
    rationale: 'Many of these creators do excellent work, but their editorial standards are self-imposed rather than institutionally enforced. There is no ombudsman, no corrections policy, and no editorial board.',
    examples: 'Breaking Points, CaspianReport, PolyMatter, Johnny Harris, Kyla Scanlon',
    note: 'This is the current backbone of Top News Clips\' source library. These channels bring audience and engagement; the library also draws on Tier 1–5 institutional sources, and every story\'s coverage count and confidence label show how much independent corroboration it has.',
  },
  {
    tier: 8,
    name: 'State Media',
    color: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',
    definition: 'Government-funded outlets where editorial direction is controlled or heavily influenced by the state. No structural independence from the funding government.',
    rationale: 'State media is included for perspective, not endorsement. In geopolitical stories, understanding how a government frames its own actions is itself newsworthy. But readers must know the source is state-directed.',
    examples: 'CGTN (China), TeleSUR (Venezuela), TRT World (Turkey)',
    note: 'Required label: "State Media, editorial direction influenced by [country] government." TRT World is included for perspective, but its editorial direction is influenced by the Turkish government. State media stories carry the same coverage check and confidence labeling as every other source, and the State Media badge is always visible.',
  },
  {
    tier: 9,
    name: 'Raw Footage',
    color: 'text-white/70 bg-white/10 border-white/15',
    definition: 'Bodycam, dashcam, security camera, and bystander video. No editorial layer. The footage is the story.',
    rationale: 'Raw footage is powerful because it removes the editorial middleman. But it also removes context. A 90-second clip can misrepresent a 90-minute encounter.',
    examples: 'Police bodycam releases, dashcam footage, bystander video',
    note: 'Raw footage is checked against coverage from 15 major US outlets and verified through our Claude-powered pipeline before publication; clips that fail verification are rejected or held for review, and clips with limited corroboration are labeled Single-source or Developing.',
  },
  {
    tier: 10,
    name: 'Community Sourced',
    color: 'text-white/70 bg-white/10 border-white/15',
    definition: 'Content surfaced from Reddit, social media, or other community platforms with no institutional origin and no editorial verification at the source.',
    rationale: 'Community-sourced content is how many stories first surface. It can be the earliest signal of a developing event. But it is also the most susceptible to misinformation, manipulation, and missing context.',
    examples: 'r/PublicFreakout, r/Bad_Cop_No_Donut, r/worldnews',
    note: 'Community-sourced content is checked against coverage from 15 major US outlets and verified through our Claude-powered pipeline before publication; stories that fail verification are rejected or held for review, and stories with limited corroboration are labeled Single-source or Developing.',
  },
]

export default function TaxonomyPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-white">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/45 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>›</span>
          <span>Source Taxonomy</span>
        </nav>

        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">
            Editorial Framework, Version 1.0
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">
            Source Credibility Taxonomy
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Every source on Top News Clips is classified into a visible credibility tier. Each story carries a source-type badge so readers can instantly calibrate how much editorial weight to give each clip. The goal is transparency, not gatekeeping: every tier serves a purpose, but readers deserve to know the difference between a Pulitzer-winning nonprofit investigation and a bystander&apos;s phone video.
          </p>
        </div>

        <div className="mb-10 p-4 bg-white/[0.03] border border-white/10 rounded-lg">
          <p className="text-sm font-semibold mb-2 text-white">How it works</p>
          <ul className="text-sm text-white/60 space-y-1.5">
            <li>Badges are assigned based on the originating channel, not the content of any individual video.</li>
            <li>If a source&apos;s classification is disputed or ambiguous, it defaults to the lower-credibility tier until reviewed.</li>
            <li>Every story — regardless of tier — is checked against coverage from 15 major US outlets and verified through our Claude-powered pipeline before publication; stories that fail verification are rejected or held for review. Stories with limited corroboration are labeled Single-source or Developing rather than presented as confirmed.</li>
            <li>Dual-fit sources (e.g. Bellingcat as both OSINT and independent news) are assigned the higher-credibility tier.</li>
          </ul>
        </div>

        <div className="space-y-6">
          {TIERS.map(({ tier, name, color, definition, rationale, examples, note }) => (
            <div key={tier} id={`tier-${tier}`} className="border border-white/10 bg-white/[0.03] rounded-lg p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-white/50 w-10 shrink-0">
                  Tier {tier}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${color}`}>
                  {tier === 8 ? `⚠ ${name}` : name}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mb-1">{definition}</p>
              <p className="text-sm text-white/65 mb-2">{rationale}</p>
              <p className="text-xs text-white/55">
                <span className="font-semibold text-white/75">Examples:</span> {examples}
              </p>
              {note && (
                <p className="text-xs text-white/55 mt-2 pt-2 border-t border-white/10">
                  ⚠ {note}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Confidence Labels */}
        <div id="confidence" className="mt-12 pt-8 border-t border-white/10">
          <h2 className="text-xl font-black tracking-tight mb-2 text-white">Confidence Labels</h2>
          <p className="text-sm text-white/60 mb-6">
            Every story carries a confidence label indicating how settled the underlying information is.
            Labels are assigned automatically based on source tier and coverage count, and may be updated
            as stories develop.
          </p>
          <div className="space-y-3">
            {[
              {
                label: 'Corroborated',
                color: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
                definition: 'Multiple independent sources confirm the core facts.',
                when: '5+ outlets have covered the story, or 3+ outlets when the originating source is Tier 1–5.',
              },
              {
                label: 'Reported',
                color: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
                definition: 'Published by a credible source with institutional editorial standards (Tier 1–6), not yet independently corroborated.',
                when: 'Source is Tier 1–6 (has a corrections policy and editorial oversight).',
              },
              {
                label: 'Developing',
                color: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',
                definition: 'Event confirmed but key details still emerging or conflicting across sources.',
                when: 'Source is Tier 7–10 with 2+ outlets covering the story.',
              },
              {
                label: 'Single-source',
                color: 'text-white/70 bg-white/10 border-white/15',
                definition: 'One source, not yet independently verified. May be credible but has not been corroborated.',
                when: 'Source is Tier 7–10 and fewer than 2 other outlets have covered the story.',
              },
              {
                label: 'Analysis',
                color: 'text-white/70 bg-white/10 border-white/15 italic',
                definition: 'Interpretation or commentary, not original fact reporting.',
                when: 'Content type is analysis or commentary, regardless of source tier.',
              },
            ].map(({ label, color, definition, when }) => (
              <div key={label} className="border border-white/10 bg-white/[0.03] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${color}`}>
                    {label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mb-1">{definition}</p>
                <p className="text-xs text-white/55"><span className="font-semibold text-white/75">Assigned when:</span> {when}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/55 mt-4">
            Labels can change as stories develop, a &ldquo;Single-source&rdquo; story may move to &ldquo;Corroborated&rdquo; as more outlets confirm details.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-xs text-white/55">
            This taxonomy is reviewed quarterly. Sources may shift tiers based on changes to their funding, editorial independence, or track record.{' '}
            <Link href="/contact" className="font-semibold text-white hover:underline underline-offset-2">
              Dispute a classification →
            </Link>
          </p>
        </div>

      </main>
      <Footer />
    </>
  )
}
