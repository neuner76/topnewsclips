import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const metadata = {
  title: 'About — TopNewsClips',
  description: 'Why we built TopNewsClips and how it works.',
}

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-10 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">About</h1>
          <p className="text-sm text-muted-foreground">
            Why we built this — and how it works.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">The problem</h2>
            <p>
              Most news is filtered through a handful of corporate outlets with shared incentives: keep you
              anxious, keep you clicking, keep you on one side. The result is a population that consumes
              enormous amounts of news and understands less and less about what&apos;s actually happening.
            </p>
            <p className="mt-3">
              Independent journalists, local reporters, and documentary filmmakers are doing some of the most
              important work in media right now — and most people never see it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">What we do</h2>
            <p>
              TopNewsClips surfaces real footage and independent journalism that mainstream outlets
              undercover or ignore. Every story is verified before it goes live. We look for:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'Bodycam, dashcam, and bystander footage of real incidents',
                'Investigative reporting from independent journalists',
                'Analysis and commentary from voices not beholden to corporate advertisers',
                'Science and technology breakthroughs covered before they go mainstream',
                'Stories with significant public interest that major outlets haven\'t touched',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[oklch(0.52_0.14_196)] shrink-0">›</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Who it&apos;s for</h2>
            <p>
              Anyone who wants to stay genuinely informed without being told what to think. We curate
              across the political spectrum — our goal is a site where someone on the left and someone
              on the right can both read the same stories and feel like they learned something real.
            </p>
            <p className="mt-3">
              If a story only resonates with one tribe, it probably doesn&apos;t belong here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How verification works</h2>
            <p>
              Every piece of content goes through an automated verification pipeline before it&apos;s
              published. We check mainstream media coverage to confirm events are real, filter out
              entertainment content and foreign news, and flag stories with an{' '}
              <span className="font-semibold">MSM Blackout</span> badge when a credible story has
              fewer than 5 major-outlet articles — meaning it&apos;s genuinely underreported.
            </p>
            <p className="mt-3">
              We&apos;re not perfect. If you see something that shouldn&apos;t be here, or something
              important we&apos;re missing, reach out.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">The daily digest</h2>
            <p>
              Each morning we generate a briefing from the previous day&apos;s best stories — written
              the way a smart friend would explain the news: what happened, who it affects, and why it
              matters. No spin. No outrage. Just the facts and the context.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
            >
              Read today&apos;s digest →
            </Link>
          </section>

        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
