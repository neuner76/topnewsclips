import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const metadata = {
  title: 'About TopNewsClips — Independent News. No Agenda.',
  description: 'TopNewsClips surfaces independent journalism, bodycam footage, and stories mainstream media undercovers. Daily briefing for non-partisan Americans who want facts, not spin.',
  alternates: { canonical: 'https://www.topnewsclips.com/about' },
}

const FAQ = [
  {
    q: 'What is TopNewsClips?',
    a: 'TopNewsClips is a daily news briefing that surfaces independent journalism, bodycam footage, and viral stories that mainstream US media undercovers. It is designed for non-partisan Americans who want factual reporting without a political agenda.',
  },
  {
    q: 'What is an MSM Blackout?',
    a: 'An MSM Blackout badge appears on stories that have fewer than 5 articles from major mainstream outlets, despite being credible and newsworthy. It signals that a story is genuinely underreported by corporate media, not that it is unverified.',
  },
  {
    q: 'What is a Global Blindspot?',
    a: 'A Global Blindspot is an international news story — a protest, political crisis, natural disaster, or major event outside the US — that the rest of the world is covering but US mainstream media is ignoring. TopNewsClips surfaces these via its Global Lens feature.',
  },
  {
    q: 'How does TopNewsClips verify stories?',
    a: 'Every story goes through an automated verification pipeline. It cross-references mainstream media coverage to confirm the event is real, checks for AI-generated content risk, and assigns a confidence score. Stories with fewer than 5 major-outlet articles receive an MSM Blackout badge.',
  },
  {
    q: 'Is TopNewsClips biased?',
    a: 'TopNewsClips does not take a political side. Stories are rejected if they only resonate with one partisan tribe. The editorial standard is: corporate corruption, government overreach, institutional failure, and police accountability are American issues — not left or right issues.',
  },
  {
    q: 'What types of content does TopNewsClips publish?',
    a: 'TopNewsClips publishes three content types: Raw (bodycam, dashcam, bystander, and security camera footage), Reported (investigative journalism from independent journalists), and Analysis (commentary and context from non-corporate voices). Each story is labeled so readers know what they are watching.',
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

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-10 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">About</h1>
          <p className="text-sm text-muted-foreground">
            Independent news. No agenda.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">The majority no one serves</h2>
            <p>
              More than half of Americans now identify as independent — not Republican, not Democrat.
              They&apos;ve watched both parties get captured by donors, ideologues, and a win-at-all-costs
              mentality that leaves ordinary citizens losing. So they left.
            </p>
            <p className="mt-3">
              But leaving isn&apos;t enough if every news source still speaks to one tribe or the other.
              Independents deserve information that helps them think — not content engineered to make
              them angry at the other side.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">What TopNewsClips is</h2>
            <p>
              A daily briefing built for people who&apos;ve moved beyond the party divide. We surface
              real footage and independent journalism that corporate media undercovers or ignores —
              verified, curated, and presented without a partisan frame.
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                'Bodycam, dashcam, and bystander footage of real incidents',
                'Investigative reporting from journalists not beholden to corporate advertisers',
                'Accountability journalism — stories powerful institutions don\'t want covered',
                'Science and technology breakthroughs before they go mainstream',
                'Stories flagged MSM Blackout when major outlets haven\'t touched them',
                'Global Blindspot — international stories the US press is ignoring',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[oklch(0.52_0.14_196)] shrink-0">›</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Our editorial standard</h2>
            <p>
              If a story only resonates with one side, it probably doesn&apos;t belong here. We curate
              for the citizen who wants to understand what&apos;s actually happening — not for the
              partisan who wants confirmation of what they already believe.
            </p>
            <p className="mt-3">
              Corporate corruption, government overreach, institutional failure, scientific breakthroughs,
              police accountability — these aren&apos;t left issues or right issues. They&apos;re
              American issues. That&apos;s the lens we apply.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How verification works</h2>
            <p>
              Every piece of content goes through an automated verification pipeline before it goes live.
              We cross-reference mainstream media coverage to confirm events are real, filter out
              entertainment and foreign news, and flag stories with an{' '}
              <span className="font-semibold">MSM Blackout</span> badge when credible stories have
              fewer than 5 major-outlet articles — meaning they&apos;re genuinely underreported.
            </p>
            <p className="mt-3">
              We&apos;re not perfect. If you see something that shouldn&apos;t be here, or something
              important we&apos;re missing, reach out.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">The daily digest</h2>
            <p>
              Each morning we publish a briefing from the day&apos;s best stories — written the way
              a smart, non-partisan friend would explain the news: what happened, who it affects,
              and why it matters to your life. No spin. No outrage. Just facts and context.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
            >
              Read today&apos;s digest →
            </Link>
          </section>

          {/* FAQ — structured for AI extraction */}
          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-6">Frequently asked questions</h2>
            <dl className="space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="border-b border-border pb-6 last:border-0 last:pb-0">
                  <dt className="font-bold text-[15px] mb-2">{q}</dt>
                  <dd className="text-muted-foreground leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

        </div>

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
