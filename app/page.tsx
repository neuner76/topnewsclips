import { createClient } from '@/lib/supabase/server'
import { getLatestDigest } from '@/lib/digest'
import type { DigestContent, NeedToKnowItem, InTheKnowItem, EtceteraItem } from '@/lib/digest'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import GlobalBlindspotBadge from '@/components/GlobalBlindspotBadge'
import SourceTypeBadge from '@/components/SourceTypeBadge'
import TrackEvent from '@/components/TrackEvent'
import Link from 'next/link'
import Image from 'next/image'
import { getSourceTier } from '@/lib/ingest/source-tier'

export const revalidate = 300

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function storyThumbnail(s: Story): string | null {
  return s.platform === 'youtube' ? getYouTubeThumbnail(s.embed_url) : s.thumbnail_url ?? null
}

const IN_THE_KNOW_CATEGORIES = [
  'Politics & World Affairs',
  'Science & Technology',
  'Business & Markets',
  'Sports, Entertainment, & Culture',
] as const

// ─── Digest components ───────────────────────────────────────────────────────

/** Returns the best available source tier for a story — uses stored value or computes on-the-fly */
function resolvedBadge(story: Story): { tier: number | null; sourceType: string | null } {
  if (story.source_tier && story.source_type) return { tier: story.source_tier, sourceType: story.source_type }
  return getSourceTier(story.journalist_username, story.source ?? '', story.category)
}

function NeedToKnowStory({ item, storyMap }: { item: NeedToKnowItem; storyMap: Map<string, Story> }) {
  const story = storyMap.get(item.slug)
  const badge = story ? resolvedBadge(story) : null
  return (
    <article className="py-6 border-b border-border last:border-0">
      {badge && (badge.tier || badge.sourceType) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <SourceTypeBadge tier={badge.tier} sourceType={badge.sourceType} />
          {story?.journalist_username && (
            <span className="text-xs text-muted-foreground">@{story.journalist_username}</span>
          )}
        </div>
      )}
      <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="group block mb-3">
        <h2 className="text-2xl font-black tracking-tight leading-snug group-hover:underline underline-offset-2">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-3">
        {item.paragraphs.map((p, i) => (
          <p key={i} className="editorial-body text-foreground/90">
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

function InTheKnowBullet({ item, storyMap }: { item: InTheKnowItem; storyMap: Map<string, Story> }) {
  const story = item.slug ? storyMap.get(item.slug) : null
  const badge = story ? resolvedBadge(story) : null
  const inner = <span className="text-[1.05rem] leading-relaxed">{item.text}</span>
  return (
    <li className="flex gap-2 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0 mt-0.5">›</span>
      <div className="flex flex-col gap-1">
        {item.slug ? (
          <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
            {inner}
          </Link>
        ) : inner}
        {badge && (badge.tier || badge.sourceType) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <SourceTypeBadge tier={badge.tier} sourceType={badge.sourceType} />
            {story?.journalist_username && (
              <span className="text-[10px] text-muted-foreground">@{story.journalist_username}</span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function DigestView({ content, date, storyMap }: { content: DigestContent; date: string; storyMap: Map<string, Story> }) {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div>
      <TrackEvent name="digest_read" />
      {/* Date */}
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-6">
        {formattedDate}
      </p>

      {/* Need To Know */}
      <section className="mb-10">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">
          Need To Know
        </p>
        <div className="divide-y divide-border">
          {content.needToKnow.map((item, i) => (
            <>
              <NeedToKnowStory key={item.slug} item={item} storyMap={storyMap} />
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
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
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
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
                  {cat}
                </p>
                <ul>
                  {items.map((item, i) => (
                    <InTheKnowBullet key={i} item={item} storyMap={storyMap} />
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
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
              Etcetera
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <ul className="space-y-3">
            {content.etcetera.map((item: EtceteraItem | string, i: number) => {
              const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
              const story = etc.slug ? storyMap.get(etc.slug) : null
              const text = <span className="text-base leading-relaxed text-muted-foreground">{etc.text}</span>
              return (
                <li key={i} className="flex flex-col gap-1">
                  {etc.slug ? (
                    <Link href={`/story/${etc.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                      {text}
                    </Link>
                  ) : text}
                  {story && (story.source_tier || story.source_type) && (
                    <SourceTypeBadge tier={story.source_tier} sourceType={story.source_type} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Global Blindspot */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_55)] uppercase shrink-0">
              🌍 Global Blindspot
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Stories the rest of the world is covering that US media is ignoring.</p>
          <ul className="space-y-4">
            {content.globalBlindspots.map((item, i) => {
              const story = storyMap.get(item.slug)
              return (
              <li key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{item.region}</span>
                  <GlobalBlindspotBadge />
                  {story && <SourceTypeBadge tier={story.source_tier} sourceType={story.source_type} />}
                </div>
                <Link
                  href={`/story/${item.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-foreground hover:underline underline-offset-2 leading-snug block mb-1"
                >
                  {item.title}
                </Link>
                <p className="text-base text-muted-foreground">{item.summary}</p>
              </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

// ─── Clips components (existing view) ────────────────────────────────────────

function SubHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mt-5 mb-1">
      {label}
    </p>
  )
}

const SECTION_CAP = 6
const MIN_TRENDING_VIEWS = 1000

interface SectionProps {
  title: string
  subtitle: string
  categorySlug?: string
  pinned: Story[]
  voices: Story[]
  stories: Story[]
  accentClass: string
}

function Section({ title, subtitle, categorySlug, pinned, voices, stories, accentClass }: SectionProps) {
  const isEmpty = pinned.length === 0 && voices.length === 0 && stories.length === 0
  // Cap total stories shown per section — pinned always show, cap applied to voices + stories
  let voicesBudget = Math.max(0, SECTION_CAP - pinned.length)
  const cappedVoices = voices.slice(0, voicesBudget)
  voicesBudget = Math.max(0, voicesBudget - cappedVoices.length)
  const cappedStories = stories.slice(0, voicesBudget)
  return (
    <section className="mb-12">
      <div className="border-l-4 border-[oklch(0.52_0.14_196)] pl-3 mb-3">
        <div className="flex items-baseline gap-3">
          <h2 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${accentClass}`}>
            {title}
          </h2>
          {categorySlug && (
            <Link href={`/category/${categorySlug}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
              See all →
            </Link>
          )}
        </div>
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
  const storyMap = new Map(all.map(s => [s.slug, s]))

  // Default to digest view when one exists, unless user explicitly chose clips
  const activeView = view === 'clips' ? 'clips' : (digest ? 'digest' : 'clips')

  function splitSection(category: 'raw' | 'reported' | 'analysis') {
    const section = all.filter(s => s.category === category && !s.region && !s.msm_gap)
    // Cap any single journalist/channel at 2 stories per section
    const channelCounts = new Map<string, number>()
    const capped = section.filter(s => {
      if (!s.journalist_username) return true
      const n = channelCounts.get(s.journalist_username) ?? 0
      if (n >= 2) return false
      channelCounts.set(s.journalist_username, n + 1)
      return true
    })
    return {
      pinned:  capped.filter(s => s.pinned),
      voices:  capped.filter(s => !s.pinned && !!s.journalist_username),
      stories: capped.filter(s => !s.pinned && !s.journalist_username && s.view_count >= MIN_TRENDING_VIEWS),
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
          <DigestView content={digest.content} date={digest.date} storyMap={storyMap} />
        ) : (
          <div>
            {/* Digest teaser — shown in clips view when a digest exists */}
            {digest && (
              <Link
                href="/"
                className="block mb-8 p-4 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors group"
              >
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">
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
                  {globalBlindspots.slice(0, SECTION_CAP).map(s => {
                    const thumb = storyThumbnail(s)
                    return (
                    <div key={s.id} className="group py-3 border-b border-border">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{s.region}</span>
                            <GlobalBlindspotBadge />
                            <SourceTypeBadge tier={s.source_tier} sourceType={s.source_type} />
                          </div>
                          <Link href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
                            <h3 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2">{s.title}</h3>
                          </Link>
                          {s.description && (
                            <p className="text-base text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                          )}
                        </div>
                        {thumb && (
                          <a href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <Image src={thumb} alt={s.title} width={96} height={56} className="rounded object-cover w-20 h-12 sm:w-24 sm:h-14 opacity-90 group-hover:opacity-100 transition-opacity" unoptimized />
                          </a>
                        )}
                      </div>
                    </div>
                    )
                  })}
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
                  {globalLens.slice(0, SECTION_CAP).map(s => {
                    const thumb = storyThumbnail(s)
                    return (
                    <div key={s.id} className="group py-3 border-b border-border">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{s.region}</span>
                            {s.msm_gap && <GlobalBlindspotBadge />}
                            <SourceTypeBadge tier={s.source_tier} sourceType={s.source_type} />
                          </div>
                          <Link href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
                            <h3 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2">{s.title}</h3>
                          </Link>
                          {s.description && (
                            <p className="text-base text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                          )}
                        </div>
                        {thumb && (
                          <a href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <Image src={thumb} alt={s.title} width={96} height={56} className="rounded object-cover w-20 h-12 sm:w-24 sm:h-14 opacity-90 group-hover:opacity-100 transition-opacity" unoptimized />
                          </a>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </section>
            )}
            <Section
              title="Analysis"
              subtitle="Independent voices making sense of what's happening and why it matters"
              categorySlug="analysis"
              pinned={analysis.pinned}
              voices={analysis.voices}
              stories={analysis.stories}
              accentClass="text-[oklch(0.45_0.22_24)]"
            />
            <Section
              title="Reported"
              subtitle="Independent journalists investigating what institutions don't want you to see"
              categorySlug="reported"
              pinned={reported.pinned}
              voices={reported.voices}
              stories={reported.stories}
              accentClass="text-[oklch(0.38_0.13_145)]"
            />
            <Section
              title="Raw Footage"
              subtitle="Bodycam, dashcam, security cam, bystander video — unfiltered and unedited"
              categorySlug="raw"
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
