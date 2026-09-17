import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Response Taxonomy | Top News Clips',
  description: 'How TopNewsClips evaluates official resources, response pathways, and reader next steps.',
  alternates: { canonical: 'https://www.topnewsclips.com/response-taxonomy' },
}

const responseTypes = [
  ['Learn', 'Background sources, official documents, primary reports, explainers, or context pages.'],
  ['Track', 'Follow-up pages, issue trackers, official update pages, timelines, or saved story clusters.'],
  ['Share responsibly', 'Context-forward sharing guidance. No outrage language, scripts, or pile-ons.'],
  ['Official process', 'Public comment periods, registration deadlines, public meetings, agency forms, or verified civic processes.'],
  ['Report', 'Official mechanisms for reporting fraud, safety issues, scams, abuse, consumer complaints, or public hazards.'],
  ['Support verified response', 'Human-approved organizations or institutions responding to an issue. V1 avoids public donation/support links unless explicitly approved.'],
  ['Local resource', 'Local government, emergency management, school, utility, or public service information.'],
]

const criteria = [
  'The URL must work and be connected to the story or issue.',
  'The resource must be time-relevant or evergreen.',
  'The reason for listing it must be explainable in one sentence.',
  'The copy must avoid manipulative urgency.',
  'The resource type and approval status must be visible where applicable.',
  'The item must not require readers to adopt a partisan or ideological position.',
]

const exclusions = [
  'Harassment campaigns, doxxing, brigading, or pressure campaigns against private individuals.',
  'Unverified donation links or organizations proposed only by AI.',
  'Partisan scripts framed as neutral action.',
  'Moralized urgency language.',
  'Actions for active violence or breaking crisis beyond Learn / Track unless manually approved.',
]

export default function ResponseTaxonomyPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-foreground">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>›</span>
          <span>Response Taxonomy</span>
        </nav>

        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            Editorial Framework, Version 1.0
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-foreground">
            Response Taxonomy
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            How TopNewsClips evaluates official resources, response pathways, and reader next steps.
          </p>
        </div>

        <section className="mb-10 p-4 bg-muted border border-border rounded-lg space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Response links are not endorsements of a political position. They are labeled pathways for learning,
            tracking, official processes, or verified resources.
          </p>
          <p>
            The goal is agency without manipulation: show what is known, what remains unclear, what official
            mechanisms exist, and how readers can stay with a story without turning the product into an advocacy feed.
          </p>
          <p>
            AI may propose resources or draft reasons, but human approval is required before any organization,
            donation link, or external response resource can appear publicly.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-black tracking-tight uppercase mb-5 text-foreground">Public Response Types</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {responseTypes.map(([title, body]) => (
              <div key={title} className="rounded-lg border border-border bg-muted p-4">
                <h3 className="font-bold mb-1 text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase mb-4 text-foreground">Public Criteria</h2>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              {criteria.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase mb-4 text-foreground">Excluded</h2>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              {exclusions.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-border bg-muted p-5">
          <h2 className="text-lg font-black tracking-tight uppercase mb-2 text-foreground">Eligibility Guardrails</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Geopolitical conflict and contested partisan stories are limited to Learn, Track, and Share responsibly.
            Active violence and breaking-crisis stories are limited to Learn and Track. Light culture and novelty
            stories do not receive response prompts by default.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/trust" className="font-semibold text-[#2563EB] hover:underline">
              Read more about trust and methodology →
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
