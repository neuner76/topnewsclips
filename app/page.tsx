import { createClient } from '@/lib/supabase/server'
import { getLatestDigest } from '@/lib/digest'
import type { DigestContent, NeedToKnowItem, InTheKnowItem } from '@/lib/digest'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import GlobalBlindspotBadge from '@/components/GlobalBlindspotBadge'
import TrackEvent from '@/components/TrackEvent'
import Link from 'next/link'

export const revalidate = 300

const IN_THE_KNOW_CATEGORIES = [
  'Politics & World Affairs',
  'Science & Technology',
  'Business & Markets',
  'Sports, Entertainment, & Culture',
] as const

// ─── Digest components ───────────────────────────────────────────────────────

function NeedToKnowStory({ item }: { item: NeedToKnowItem }) {
  return (
    <article className="py-6 border-b border-border last:border-0">
      <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="group block mb-3">
        <h2 className="text-xl font-black tracking-tight leading-snug group-hover:underline underline-offset-2">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-3">
        {item.paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-foreground/90">
            {p}
          </p>
        ))}
      </div>
      <Link
        href={`/story/${item.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Watch →
      </Link>
    </article>
  )
}

function InTheKnowBullet({ item }: { item: InTheKnowItem }) {
  const inner = <span className="text-[15px] leading-relaxed">{item.text}</span>
  return (
    <li className="flex gap-2 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0 mt-0.5">›</span>
      {item.slug ? (
        <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
          {inner}
        </Link>
      ) : inner}
    </li>
  )
}

function DigestView({ content, date }: { content: DigestContent; date: string }) {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div>
      <TrackEvent name="digest_read" />
      {/* Date */}
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-6">
        {formattedDate}
      </p>

      {/* Need To Know */}
      <section className="mb-10">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
          Need To Know
        </p>
        <div className="divide-y divide-border">
          {content.needToKnow.map((item, i) => (
            <>
              <NeedToKnowStory key={item.slug} item={item} />
              {i === 0 && content.needToKnow.length > 1 && (
                <div key="subscribe-nudge" className="py-4">
                  <EmailCaptureInline nudge />
                </div>
              )}
            </>
          ))}
        </div>
      </section>

      {/* In The Know */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-border" />
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0">
            In The Know
          </span>
          <div className="flex-1 border-t border-border" />
        </div>
        <div className="space-y-8">
          {IN_THE_KNOW_CATEGORIES.map((cat) => {
            const items = content.inTheKnow[cat]
            if (!items?.length) return null
            return (
              <div key={cat}>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
                  {cat}
                </p>
                <ul>
                  {items.map((item, i) => (
                    <InTheKnowBullet key={i} item={item} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Etcetera */}
      {content.etcetera?.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0">
              Etcetera
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <ul className="space-y-3">
            {content.etcetera.map((item, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Global Blindspot */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-[10px] font-bold tracking-widest text-[oklch(0.52_0.14_55)] uppercase shrink-0">
              🌍 Global Blindspot
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Stories the rest of the world is covering that US media is ignoring.</p>
          <ul className="space-y-4">
            {content.globalBlindspots.map((item, i) => (
              <li key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase block mb-1">{item.region}</span>
                <Link
                  href={`/story/${item.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] font-semibold text-foreground hover:underline underline-offset-2 leading-snug block mb-1"
                >
                  {item.title}
                </Link>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ─── Clips components (existing view) ────────────────────────────────────────

function SubHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-5 mb-1">
      {label}
    </p>
  )
}

const SECTION_CAP = 6

interface SectionProps {
  title: string
  subtitle: string
  pinned: Story[]
  voices: Story[]
  stories: Story[]
  accentClass: string
}

function Section({ title, subtitle, pinned, voices, stories, accentClass }: SectionProps) {
  const isEmpty = pinned.length === 0 && voices.length === 0 && stories.length === 0
  // Cap total stories shown per section — pinned always show, cap applied to voices + stories
  let voicesBudget = Math.max(0, SECTION_CAP - pinned.length)
  const cappedVoices = voices.slice(0, voicesBudget)
  voicesBudget = Math.max(0, voicesBudget - cappedVoices.length)
  const cappedStories = stories.slice(0, voicesBudget)
  return (
    <section className="mb-12">
      <div className="border-l-4 border-[oklch(0.52_0.14_196)] pl-3 mb-3">
        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${accentClass}`}>
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-6">Stories being curated — check back soon.</p>
      ) : (
        <div>
          {pinned.length > 0 && (
            <>
              <SubHeader label="Featured" />
              {pinned.map(s => <StoryCard key={s.id} story={s} />)}
            </>
          )}
          {cappedVoices.length > 0 && (
            <>
              <SubHeader label="Independent Voices" />
              {cappedVoices.map(s => <StoryCard key={s.id} story={s} />)}
            </>
          )}
          {cappedStories.length > 0 && (
            <>
              <SubHeader label="Trending" />
              {cappedStories.map(s => <StoryCard key={s.id} story={s} />)}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams

  const [digest, storiesResult] = await Promise.all([
    getLatestDigest(),
    (async () => {
      const supabase = await createClient()
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      return supabase
        .from('stories')
        .select('*')
        .eq('published', true)
        .gte('created_at', sevenDaysAgo)
        .order('pinned', { ascending: false })
        .order('display_order', { ascending: true })
        .order('view_count', { ascending: false })
        .limit(200)
    })(),
  ])

  const all = (storiesResult.data as Story[]) ?? []

  // Default to digest view when one exists, unless user explicitly chose clips
  const activeView = view === 'clips' ? 'clips' : (digest ? 'digest' : 'clips')

  function splitSection(category: 'raw' | 'reported' | 'analysis') {
    const section = all.filter(s => s.category === category && !s.region && !s.msm_gap)
    return {
      pinned:  section.filter(s => s.pinned),
      voices:  section.filter(s => !s.pinned && !!s.journalist_username),
      stories: section.filter(s => !s.pinned && !s.journalist_username),
    }
  }

  const raw      = splitSection('raw')
  const reported = splitSection('reported')
  const analysis = splitSection('analysis')
  const uncategorized = all.filter(s => !s.category && !s.region)
  const msmBlackout = all.filter(s => s.msm_gap && !s.region)

  // Global Lens — one top story per region, excluding Blindspot stories
  const globalStories = all.filter(s => !!s.region)
  const globalBlindspots = globalStories.filter(s => s.msm_gap)
  const blindspotIds = new Set(globalBlindspots.map(s => s.id))
  const globalByRegion = new Map<string, Story>()
  for (const s of globalStories) {
    if (!blindspotIds.has(s.id) && !globalByRegion.has(s.region!)) globalByRegion.set(s.region!, s)
  }
  const globalLens = [...globalByRegion.values()]

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Masthead */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Today&apos;s Top Clips
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What mainstream media misses. What the world is watching. In 5 minutes.
          </p>
          <p className="text-xs text-muted-foreground mt-3">Free daily briefing — 5 minutes, no spin.</p>
          <EmailCaptureInline />
        </div>

        {/* Tab switcher */}
        {digest && (
          <div className="flex border border-border rounded-lg overflow-hidden mb-8 text-sm font-semibold">
            <Link
              href="/"
              className={`flex-1 text-center py-2.5 transition-colors ${
                activeView === 'digest'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Digest
            </Link>
            <Link
              href="/?view=clips"
              className={`flex-1 text-center py-2.5 transition-colors border-l border-border ${
                activeView === 'clips'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Clips
            </Link>
          </div>
        )}

        {/* Content */}
        {activeView === 'digest' && digest ? (
          <DigestView content={digest.content} date={digest.date} />
        ) : (
          <div>
            {/* Digest teaser — shown in clips view when a digest exists */}
            {digest && (
              <Link
                href="/"
                className="block mb-8 p-4 rounded-lg border border-border bg-zinc-50 hover:bg-zinc-100 transition-colors group"
              >
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
                  Today&apos;s Digest
                </p>
                <p className="text-base font-bold leading-snug group-hover:underline underline-offset-2 mb-1">
                  {digest.content.needToKnow[0]?.sectionTitle}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {digest.content.needToKnow[0]?.paragraphs[0]}
                </p>
                <p className="text-xs font-semibold mt-2 text-foreground">
                  Read full digest →
                </p>
              </Link>
            )}
            {msmBlackout.length > 0 && (
              <section className="mb-12">
                <div className="border-l-4 border-[oklch(0.52_0.14_196)] pl-3 mb-3">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-[oklch(0.52_0.14_196)]">
                    Limited Coverage
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Stories receiving little attention from mainstream outlets</p>
                </div>
                <div>
                  {msmBlackout.slice(0, 6).map(s => <StoryCard key={s.id} story={s} />)}
                </div>
              </section>
            )}
            {globalBlindspots.length > 0 && (
              <section className="mb-12">
                <div className="border-l-4 border-[oklch(0.58_0.14_55)] pl-3 mb-3">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-[oklch(0.52_0.14_55)]">
                    Global Blindspot
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Stories the rest of the world is covering that US media is ignoring</p>
                </div>
                <div>
                  {globalBlindspots.slice(0, SECTION_CAP).map(s => (
                    <div key={s.id} className="group py-3 border-b border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{s.region}</span>
                        <GlobalBlindspotBadge />
                      </div>
                      <Link href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
                        <h3 className="font-bold text-[15px] leading-snug group-hover/title:underline underline-offset-2">{s.title}</h3>
                      </Link>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {globalLens.length > 0 && (
              <section className="mb-12">
                <div className="border-l-4 border-[oklch(0.52_0.14_196)] pl-3 mb-3">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-[oklch(0.52_0.14_196)]">
                    Global Lens
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">How the world is covering today&apos;s biggest stories</p>
                </div>
                <div>
                  {globalLens.slice(0, SECTION_CAP).map(s => (
                    <div key={s.id} className="group py-3 border-b border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{s.region}</span>
                        {s.msm_gap && <GlobalBlindspotBadge />}
                      </div>
                      <Link href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
                        <h3 className="font-bold text-[15px] leading-snug group-hover/title:underline underline-offset-2">{s.title}</h3>
                      </Link>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            <Section
              title="Analysis"
              subtitle="Independent voices making sense of what's happening and why it matters"
              pinned={analysis.pinned}
              voices={analysis.voices}
              stories={analysis.stories}
              accentClass="text-[oklch(0.45_0.22_24)]"
            />
            <Section
              title="Reported"
              subtitle="Independent journalists investigating what institutions don't want you to see"
              pinned={reported.pinned}
              voices={reported.voices}
              stories={reported.stories}
              accentClass="text-[oklch(0.38_0.13_145)]"
            />
            <Section
              title="Raw Footage"
              subtitle="Bodycam, dashcam, security cam, bystander video — unfiltered and unedited"
              pinned={raw.pinned}
              voices={raw.voices}
              stories={raw.stories}
              accentClass="text-foreground"
            />
            {uncategorized.length > 0 && (
              <Section
                title="Latest"
                subtitle="Recently added"
                pinned={[]}
                voices={[]}
                stories={uncategorized}
                accentClass="text-muted-foreground"
              />
            )}
          </div>
        )}

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
