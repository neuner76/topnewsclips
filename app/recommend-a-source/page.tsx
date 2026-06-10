import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import SubmitForm from './SubmitForm'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Recommend a Source | Top News Clips',
  description: 'Know a channel or outlet we should add? Submit it for editorial review. Every submission is evaluated against our published 10-tier taxonomy and the decision, accepted or declined, with rationale, is made public.',
  alternates: { canonical: 'https://www.topnewsclips.com/recommend-a-source' },
  openGraph: {
    title: 'Recommend a Source | Top News Clips',
    description: 'Submit a source for editorial review. Every decision is made public.',
    url: 'https://www.topnewsclips.com/recommend-a-source',
  },
  twitter: {
    card: 'summary',
    title: 'Recommend a Source | Top News Clips',
    description: 'Submit a source for editorial review. Every decision is made public.',
    site: '@topnewsclips',
  },
}

const CRITERIA = [
  {
    label: 'Original work',
    body: 'Does the channel produce original reporting, commentary, or footage, not just repackage other outlets\' content?',
  },
  {
    label: 'Publishing frequency',
    body: 'Does it publish regularly enough to be a useful ongoing source? At least a few times per month.',
  },
  {
    label: 'Transparent funding',
    body: 'Can you determine how the outlet is funded? Nonprofit, individual creator, ad-supported, state-funded? We need to know to classify it correctly.',
  },
  {
    label: 'Editorial standards',
    body: 'Does the channel correct mistakes? Is there a stated editorial policy or methodology? Even independent creators can meet this bar.',
  },
  {
    label: 'Tier fit',
    body: 'Does it fit one of our 10 credibility tiers? Raw footage, wire service, independent commentary, nonprofit investigative, there\'s a tier for most legitimate sources.',
  },
  {
    label: 'Not primarily entertainment',
    body: 'The source must primarily produce news, analysis, or journalism, not entertainment, lifestyle, or satire that occasionally touches news topics.',
  },
]

const STATUS_STYLES: Record<string, string> = {
  submitted:     'text-white/70 bg-white/10 border-white/15',
  under_review:  'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',
  accepted:      'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
  declined:      'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
}

const STATUS_LABELS: Record<string, string> = {
  submitted:     'Submitted',
  under_review:  'Under Review',
  accepted:      'Accepted',
  declined:      'Declined',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Submission {
  id: string
  created_at: string
  channel_url: string
  reason: string
  suggested_tier: number | null
  status: string
  reviewed_at: string | null
  decision_tier: number | null
  decision_rationale: string | null
}

export default async function RecommendASourcePage() {
  const supabase = await createClient()

  const { data: submissions } = await supabase
    .from('source_submissions')
    .select('id, created_at, channel_url, reason, suggested_tier, status, reviewed_at, decision_tier, decision_rationale')
    .in('status', ['under_review', 'accepted', 'declined'])
    .order('created_at', { ascending: false })
    .limit(100)

  const log = (submissions ?? []) as Submission[]

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-white">

        <div className="mb-10 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            {' › '}Recommend a Source
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">Recommend a Source</h1>
          <p className="text-base text-white/70 leading-relaxed">
            Know a YouTube channel, outlet, or journalist we should add to the source library?
            Submit it below. Every submission is evaluated against our{' '}
            <Link href="/taxonomy" className="font-semibold text-white hover:underline underline-offset-2">
              published 10-tier taxonomy
            </Link>{' '}
           , and the decision, with rationale, is made public in the review log at the bottom of this page.
          </p>
        </div>

        <div className="space-y-12 text-[15px] leading-relaxed text-white/80">

          {/* Submission form */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-5 text-white">Submit a recommendation</h2>
            <SubmitForm />
          </section>

          {/* What we evaluate */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-2 text-white">What we evaluate</h2>
            <p className="text-sm text-white/60 mb-5">
              Every submission is checked against these six criteria. Reading them before you submit will help you self-screen, and write a stronger reason.
            </p>
            <div className="space-y-4">
              {CRITERIA.map(({ label, body }, i) => (
                <div key={label} className="flex gap-4">
                  <span className="text-[oklch(0.52_0.14_196)] font-black text-lg leading-snug shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <div>
                    <p className="font-semibold text-white">{label}</p>
                    <p className="text-sm text-white/60 mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Review rules */}
          <section className="p-5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white/65 space-y-2">
            <p className="font-semibold text-white">Before you submit</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><span className="shrink-0">–</span><span>We review up to 10 community-submitted sources per week. High volume may extend the queue.</span></li>
              <li className="flex gap-2"><span className="shrink-0">–</span><span>Submitting a source does not guarantee review or acceptance.</span></li>
              <li className="flex gap-2"><span className="shrink-0">–</span><span>Editorial decisions are final, but you can dispute a classification via the <Link href="/contact" className="font-semibold text-white hover:underline underline-offset-2">contact form</Link>.</span></li>
              <li className="flex gap-2"><span className="shrink-0">–</span><span>Accepted sources receive a &ldquo;Community Nominated&rdquo; badge for 90 days alongside their tier badge.</span></li>
              <li className="flex gap-2"><span className="shrink-0">–</span><span>Declined sources show a one-sentence rationale in the log below. We decline publicly so the reasoning is on record.</span></li>
            </ul>
          </section>

          {/* Public review log */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-2 text-white">Review log</h2>
            <p className="text-sm text-white/60 mb-6">
              Every submission that has entered the review queue is listed here. Newly submitted sources appear once the weekly review batch begins.
            </p>

            {log.length === 0 ? (
              <p className="text-sm text-white/60 py-8 text-center border border-dashed border-white/15 rounded-lg">
                No submissions in the review queue yet. Be the first to recommend a source.
              </p>
            ) : (
              <div className="space-y-4">
                {log.map((s) => (
                  <div key={s.id} className="border border-white/10 bg-white/[0.03] rounded-lg p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <a
                        href={s.channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-white hover:underline underline-offset-2 break-all leading-snug"
                      >
                        {s.channel_url}
                      </a>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border shrink-0 ${STATUS_STYLES[s.status] ?? STATUS_STYLES.submitted}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </div>

                    <p className="text-white/65 leading-relaxed mb-2">{s.reason}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                      <span>Submitted {formatDate(s.created_at)}</span>
                      {s.suggested_tier && <span>Suggested: Tier {s.suggested_tier}</span>}
                      {s.reviewed_at && <span>Reviewed {formatDate(s.reviewed_at)}</span>}
                      {s.decision_tier && <span>Assigned: Tier {s.decision_tier}</span>}
                    </div>

                    {s.decision_rationale && (
                      <div className={`mt-3 pt-3 border-t border-white/10 text-xs ${s.status === 'declined' ? 'text-white/60' : 'text-[oklch(0.78_0.12_145)]'}`}>
                        <span className="font-semibold uppercase tracking-wide mr-1">
                          {s.status === 'accepted' ? 'Decision:' : 'Declined '}
                        </span>
                        {s.decision_rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

      </main>
      <Footer />
    </>
  )
}
