import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Corrections | Top News Clips',
  description: 'If we got something wrong, a misstated fact, a misclassified source, a misleading frame, we want to hear about it. Trust is built by being reachable and willing to get better in public.',
  alternates: { canonical: 'https://www.topnewsclips.com/corrections' },
  openGraph: {
    title: 'Corrections | Top News Clips',
    description: 'If we got something wrong, we want to hear about it.',
    url: 'https://www.topnewsclips.com/corrections',
  },
  twitter: {
    card: 'summary',
    title: 'Corrections | Top News Clips',
    description: 'If we got something wrong, we want to hear about it.',
    site: '@topnewsclips',
  },
}

export default function CorrectionsPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-white">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            {' › '}Corrections
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">Corrections &amp; Feedback</h1>
          <p className="text-base text-white/70 leading-relaxed">
            Trust is not built by pretending nothing ever goes wrong.
            It is built by being reachable, responsive, and willing to get better in public.
          </p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-white/80">

          <section>
            <p className="mb-4">If we:</p>
            <ul className="space-y-2 mb-6">
              {[
                'misstated a fact',
                'misclassified a source',
                'missed important context',
                'overweighted or underweighted a story',
                'framed something in a misleading way',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-white/65">
                  <span className="shrink-0 text-white/35"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>we want to hear about it.</p>
          </section>

          <div className="p-5 border border-white/10 bg-white/[0.03] rounded-lg">
            <p className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase mb-1">
              Corrections
            </p>
            <p className="text-sm text-white/65 mb-3">
              Send us the story URL, the specific issue, and any supporting context. Confirmed corrections
              are applied promptly. We don&apos;t memory-hole mistakes, if something was editorially out
              of bounds, we&apos;ll note it was updated.
            </p>
            <a
              href="mailto:corrections@topnewsclips.com"
              className="text-sm font-semibold text-white hover:underline underline-offset-2"
            >
              corrections@topnewsclips.com
            </a>
          </div>

          <div className="text-sm text-white/60 border-t border-white/10 pt-6">
            <p className="font-semibold text-white mb-1">Corrections log</p>
            <p>We will publish confirmed corrections here as they occur.</p>
          </div>

        </div>

      </main>
      <Footer />
    </>
  )
}
