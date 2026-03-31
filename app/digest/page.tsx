import { getLatestDigest } from '@/lib/digest'
import type { NeedToKnowItem, InTheKnowItem, EtceteraItem, GlobalLensItem, MainstreamPulseItem } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'

export const revalidate = 300

const IN_THE_KNOW_CATEGORIES = [
  'Politics & World Affairs',
  'Science & Technology',
  'Business & Markets',
  'Sports, Entertainment, & Culture',
] as const

function formatDate(iso: string) {
  // Append T12:00:00 to avoid UTC midnight rolling back one day in US timezones
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <div className="flex-1 border-t border-border" />
      <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0">
        {label}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

function NeedToKnowStory({ item }: { item: NeedToKnowItem }) {
  return (
    <article className="mb-10">
      <Link href={`/story/${item.slug}`} className="group block mb-3">
        <h2 className="text-xl font-black tracking-tight leading-snug group-hover:underline">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-3">
        {item.paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {p}
          </p>
        ))}
      </div>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-4 pl-3 border-l-2 border-border space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            How the world sees it
          </p>
          {item.howWorldSeesIt.map((w, i) => (
            <div key={i}>
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mr-2">
                {w.region}
              </span>
              <span className="text-xs text-foreground/80">{w.summary}</span>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/story/${item.slug}`}
        className="inline-block mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Watch →
      </Link>
    </article>
  )
}

function InTheKnowBullet({ item }: { item: InTheKnowItem }) {
  const content = (
    <span className="text-sm leading-relaxed">{item.text}</span>
  )
  return (
    <li className="flex gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">›</span>
      {item.slug ? (
        <Link href={`/story/${item.slug}`} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  )
}

export default async function DigestPage() {
  const digest = await getLatestDigest()

  if (!digest) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No digest yet — check back soon.
          </p>
        </main>
        <Footer />
      </>
    )
  }

  const { content } = digest

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Masthead */}
        <div className="mb-8 border-b-2 border-foreground pb-4">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            {formatDate(digest.date)}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">TopNewsClips Daily</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Independent journalism. Real footage. No corporate filter.
          </p>
        </div>

        {/* Need To Know */}
        <section>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6">
            Need To Know
          </p>
          {content.needToKnow.map((item) => (
            <NeedToKnowStory key={item.slug} item={item} />
          ))}
        </section>

        <SectionDivider label="In The Know" />

        {/* In The Know */}
        <section className="space-y-8">
          {IN_THE_KNOW_CATEGORIES.map((cat) => {
            const items = content.inTheKnow[cat]
            if (!items?.length) return null
            return (
              <div key={cat}>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
                  {cat}
                </p>
                <ul className="divide-y divide-border/50">
                  {items.map((item, i) => (
                    <InTheKnowBullet key={i} item={item} />
                  ))}
                </ul>
              </div>
            )
          })}
        </section>

        {/* Etcetera */}
        {content.etcetera?.length > 0 && (
          <>
            <SectionDivider label="Etcetera" />
            <section>
              <ul className="space-y-2">
                {content.etcetera.map((item: EtceteraItem | string, i: number) => {
                  const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
                  return (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {etc.slug ? (
                        <Link href={`/story/${etc.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                          {etc.text}
                        </Link>
                      ) : etc.text}
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}

        {/* Mainstream Pulse */}
        {content.mainstreamPulse && content.mainstreamPulse.length > 0 && (
          <>
            <SectionDivider label="Mainstream Pulse" />
            <section>
              <p className="text-xs text-muted-foreground mb-4">
                What the major outlets are leading with today.
              </p>
              <ul className="space-y-2">
                {content.mainstreamPulse.map((item: MainstreamPulseItem, i: number) => (
                  <li key={i} className="flex gap-3 items-baseline py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0 w-24">{item.source}</span>
                    <span className="text-sm leading-relaxed">{item.headline}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Global Lens */}
        {content.globalLens && content.globalLens.length > 0 && (
          <>
            <SectionDivider label="🌍 Global Lens" />
            <section>
              <p className="text-xs text-muted-foreground mb-4">
                How international outlets are covering today&apos;s stories — perspectives US media isn&apos;t amplifying.
              </p>
              <div className="space-y-4">
                {content.globalLens.map((item: GlobalLensItem) => (
                  <div key={item.slug} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                        {item.region}
                      </span>
                    </div>
                    <Link
                      href={`/story/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-foreground hover:underline underline-offset-2 leading-snug block mb-1"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <EmailCapture />

        <div className="mt-4 pt-6 border-t border-border text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to all clips
          </Link>
        </div>

      </main>
      <Footer />
    </>
  )
}
