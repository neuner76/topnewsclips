import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const revalidate = 3600

export const metadata = {
  title: 'About Top News Clips, Independent News. No Agenda.',
  description: 'Top News Clips is an independent daily news briefing founded by Eric Neuner, built for Americans who want to understand what\'s actually happening, not just what the algorithm wants them to see.',
  alternates: { canonical: 'https://www.topnewsclips.com/about' },
  openGraph: {
    title: 'About Top News Clips, Independent News. No Agenda.',
    description: 'Top News Clips surfaces verified stories mainstream media is underreporting, shows how the rest of the world covers today\'s events, and labels every source by credibility tier.',
    url: 'https://www.topnewsclips.com/about',
  },
  twitter: {
    card: 'summary',
    title: 'About Top News Clips, Independent News. No Agenda.',
    description: 'Top News Clips surfaces verified stories mainstream media is underreporting, shows how the rest of the world covers today\'s events, and labels every source by credibility tier.',
    site: '@topnewsclips',
  },
}

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-10 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">About</h1>
          <p className="text-sm text-muted-foreground">
            The full picture, not the profitable picture.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-10 text-[15px] leading-relaxed">

          {/* About Top News Clips */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">About Top News Clips</h2>
            <p>
              Top News Clips is an independent daily news briefing founded by Eric Neuner.
            </p>
            <p className="mt-3">
              It was built for people who want a broader, steadier view of the news, one that includes
              international perspectives, independent investigations, and institutional reporting from
              across the source spectrum.
            </p>
            <p className="mt-3">
              Most people are not suffering from an information shortage. They&apos;re suffering from an
              incomplete picture, fragmented across outlets, shaped by engagement incentives, and often
              missing broader global context.
            </p>
            <p className="mt-3">
              Every morning, Top News Clips delivers a briefing that surfaces credible stories receiving
              limited mainstream attention, covers international events receiving significant global coverage,
              shows how journalists in other countries frame the same events, and labels every source by
              a published credibility tier, so you always know what kind of reporting you&apos;re reading.
            </p>
            <p className="mt-3">
              Our goal: the full picture in 5 minutes.
            </p>
          </section>

          {/* About Eric Neuner */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">About Eric Neuner</h2>
            <p>
              Eric Neuner is the founder of Top News Clips. He lives in Marin County, California, where
              he has spent over a decade building ventures across media, real estate, and sustainable land
              development, including co-founding an intentional community that recently celebrated its
              10th anniversary.
            </p>
            <p className="mt-3">
              He started Top News Clips because his own morning news routine felt broken: too many tabs,
              too much repetition, no easy way to see which sources were behind each story or what the
              rest of the world was saying about the same events. When he couldn&apos;t find a briefing
              that solved those problems, he built one.
            </p>
            <p className="mt-3">
              The site is self-funded. There are no investors, advertisers, or institutional backers.
              Revenue comes from voluntary subscriptions. Eric can be reached at{' '}
              <a href="mailto:eric@topnewsclips.com" className="text-[oklch(0.52_0.14_196)] hover:underline">
                eric@topnewsclips.com
              </a>
              .
            </p>
          </section>

          {/* How it works */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How it works</h2>
            <p>
              Every morning, the pipeline pulls from 50+ sources across 10 credibility tiers, filters
              noise, classifies every source, checks coverage against 15 mainstream outlets,
              pressure-tests stories with multiple AI models, and assembles a briefing with visible
              source labels and coverage counts.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <Link href="/how-it-works" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
                See the full process →
              </Link>
              <Link href="/how-it-works#selection" className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline">
                What qualifies a story →
              </Link>
            </div>
          </section>

          {/* Editorial standard */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Editorial standard</h2>
            <p>
              We look for stories that matter beyond one ideological lane and hold up under broader scrutiny.
            </p>
            <p className="mt-3">
              We prioritize developments with broad public consequence, not just partisan heat.
            </p>
          </section>

          {/* Funding */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How we&apos;re funded</h2>
            <p>
              Top News Clips is independently operated and funded by its founder. No investors.
              No advertisers. No institutional backing. Revenue comes from voluntary subscriptions.
              No one is paying us to cover, or not cover, any story.
            </p>
          </section>

          {/* Corrections */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Corrections</h2>
            <p>
              We&apos;re not perfect. If a story is mislabeled, a summary overstates the source material,
              or a tier badge is wrong, we want to know. Trust is not built by pretending nothing ever goes
              wrong, it&apos;s built by being reachable, responsive, and willing to get better in public.
            </p>
            <Link
              href="/corrections"
              className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
            >
              Submit a correction →
            </Link>
          </section>

          {/* Further reading */}
          <section className="border-t border-border pt-8">
            <h2 className="text-lg font-black tracking-tight uppercase mb-4">Further reading</h2>
            <ul className="space-y-3 text-sm">
              {[
                { href: '/how-it-works', label: 'How It Works', desc: 'The full 7-step pipeline process' },
                { href: '/trust', label: 'Why Trust This', desc: 'What earns trust, and what we don\'t claim' },
                { href: '/faq', label: 'FAQ', desc: 'Common questions answered' },
                { href: '/taxonomy', label: 'Source Taxonomy', desc: 'How we classify every source in 10 tiers' },
                { href: '/corrections', label: 'Corrections', desc: 'How to report an error' },
              ].map(({ href, label, desc }) => (
                <li key={href} className="flex gap-3 items-baseline">
                  <Link href={href} className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline shrink-0">
                    {label}
                  </Link>
                  <span className="text-muted-foreground"> {desc}</span>
                </li>
              ))}
            </ul>
          </section>

        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
