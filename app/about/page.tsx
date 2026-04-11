import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const revalidate = 3600

export const metadata = {
  title: 'About Top News Clips — Independent News. No Agenda.',
  description: 'Top News Clips is an independent daily news briefing founded by Eric Neuner — built for Americans who want to understand what\'s actually happening, not just what the algorithm wants them to see.',
  alternates: { canonical: 'https://www.topnewsclips.com/about' },
  openGraph: {
    title: 'About Top News Clips — Independent News. No Agenda.',
    description: 'Top News Clips surfaces verified stories mainstream media is underreporting, shows how the rest of the world covers today\'s events, and labels every source by credibility tier.',
    url: 'https://www.topnewsclips.com/about',
  },
  twitter: {
    card: 'summary',
    title: 'About Top News Clips — Independent News. No Agenda.',
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
              It was built for people who want a broader, steadier view of the news — one that includes
              international perspectives, independent investigations, and institutional reporting from
              across the source spectrum.
            </p>
            <p className="mt-3">
              We believe most people benefit from seeing more of the picture: how the same story looks
              from different countries, which credible stories are receiving less mainstream attention,
              and what type of source is behind each piece of reporting.
            </p>
            <p className="mt-3">
              Every morning, Top News Clips delivers a briefing that surfaces credible stories receiving
              limited mainstream attention, covers international events receiving significant global coverage,
              shows how journalists in other countries frame the same events, and labels every source by
              a published credibility tier — so you always know what kind of reporting you&apos;re reading.
            </p>
            <p className="mt-3">
              Our goal: the full picture in 5 minutes.
            </p>
          </section>

          {/* About Eric Neuner */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">About Eric Neuner</h2>
            <p>
              Top News Clips was founded by Eric Neuner, an entrepreneur and builder based in Marin County,
              California.
            </p>
            <p className="mt-3">
              Eric has spent his career building systems that help people cut through noise and focus on
              what matters — from community building to technology to independent media.
            </p>
            <p className="mt-3">
              He started Top News Clips because he wanted a daily briefing that showed him the full picture:
              what outlets were covering, what they weren&apos;t, how the rest of the world saw the same events,
              and who was behind each source. When he couldn&apos;t find one, he built it.
            </p>
            <p className="mt-3">
              The site is self-funded. There are no investors, no advertisers, and no institutional backers.
              Eric can be reached at{' '}
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
            <Link
              href="/how-it-works"
              className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
            >
              See the full process →
            </Link>
          </section>

          {/* Editorial standard */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Editorial standard</h2>
            <p>
              If a story only resonates with one side, it probably doesn&apos;t belong here. We curate
              for the citizen who wants to understand what&apos;s actually happening — not for the partisan
              who wants confirmation of what they already believe.
            </p>
            <p className="mt-3">
              Corporate corruption, government overreach, police accountability — these aren&apos;t left
              issues or right issues. They&apos;re American issues. That&apos;s the lens we apply.
            </p>
          </section>

          {/* Funding */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How we&apos;re funded</h2>
            <p>
              Top News Clips is independently operated and funded by its founder. No investors.
              No advertisers. No institutional backing. Revenue comes from voluntary subscriptions.
              No one is paying us to cover — or not cover — any story.
            </p>
          </section>

          {/* Corrections */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Corrections</h2>
            <p>
              We&apos;re not perfect. If a story is mislabeled, a summary overstates the source material,
              or a tier badge is wrong, we want to know. Trust is not built by pretending nothing ever goes
              wrong — it&apos;s built by being reachable, responsive, and willing to get better in public.
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
                { href: '/trust', label: 'Why Trust This', desc: 'What earns trust — and what we don\'t claim' },
                { href: '/faq', label: 'FAQ', desc: 'Common questions answered' },
                { href: '/taxonomy', label: 'Source Taxonomy', desc: 'How we classify every source in 10 tiers' },
                { href: '/corrections', label: 'Corrections', desc: 'How to report an error' },
              ].map(({ href, label, desc }) => (
                <li key={href} className="flex gap-3 items-baseline">
                  <Link href={href} className="font-semibold text-[oklch(0.52_0.14_196)] hover:underline shrink-0">
                    {label}
                  </Link>
                  <span className="text-muted-foreground">— {desc}</span>
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
