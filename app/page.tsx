import { createClient } from '@/lib/supabase/server'
import { getLatestDigest } from '@/lib/digest'
import type { DigestContent, NeedToKnowItem, InTheKnowItem, EtceteraItem, HowWorldSeesItItem, GlobalLensItem, MainstreamPulseItem } from '@/lib/digest'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import GlobalBlindspotBadge from '@/components/GlobalBlindspotBadge'
import SourceTypeBadge from '@/components/SourceTypeBadge'
import TierMeter from '@/components/TierMeter'
import HeroStory from '@/components/HeroStory'
import GlobalBlindspotSection from '@/components/GlobalBlindspotSection'
import TrackEvent from '@/components/TrackEvent'
import Link from 'next/link'
import Image from 'next/image'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'
import { getOutletDescriptor } from '@/lib/outlet-descriptors'
import ConfidenceBadge from '@/components/ConfidenceBadge'
import PressureScore from '@/components/PressureScore'
import MSMBadge from '@/components/MSMBadge'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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
  'Comedy & Satire',
] as const

// ─── Digest components ───────────────────────────────────────────────────────

/**
 * Compute source tier for display. Fresh computation takes priority (fixes stale DB values
 * from before taxonomy corrections). Exception: if the static lookup returns null or the
 * generic Tier 7 handle catch-all, fall back to the DB-stored tier — this covers
 * community-accepted sources that have a tier in featured_journalists but aren't yet
 * in the static lookup table in source-tier.ts.
 */
function resolvedBadge(story: Story): { tier: number | null; sourceType: string | null } {
  const fresh = getSourceTier(story.journalist_username, story.source ?? '', story.category)
  const isGenericFallback =
    fresh.tier === null ||
    (fresh.tier === 7 && fresh.sourceType === 'Independent Commentary' && story.source_tier && story.source_tier !== 7)
  if (isGenericFallback && story.source_tier) {
    return { tier: story.source_tier, sourceType: story.source_type }
  }
  return fresh
}

const PARA_LABELS = ['What happened', 'Why it matters'] as const

function NeedToKnowStory({ item, storyMap }: { item: NeedToKnowItem; storyMap: Map<string, Story> }) {
  const story = storyMap.get(item.slug)
  const badge = story ? resolvedBadge(story) : null
  const hasAttribution = badge?.tier || badge?.sourceType || story?.journalist_username
  return (
    <article className="py-6 border-b border-border last:border-0">
      {(hasAttribution || story?.msm_gap) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
            {(badge?.tier || badge?.sourceType) && <TierMeter tier={badge.tier} sourceType={badge.sourceType} />}
          {story && <ConfidenceBadge label={getConfidenceLabel(story)} />}
          {story?.journalist_username && (
            <span className="text-xs text-muted-foreground">@{story.journalist_username}</span>
          )}
          {story?.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
        </div>
      )}
      <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="group block mb-3">
        <h2 className="text-2xl font-black tracking-tight leading-snug group-hover:underline underline-offset-2">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-4">
        {item.paragraphs.slice(0, 2).map((p, i) => (
          <div key={i}>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1">
              {PARA_LABELS[i]}
            </p>
            <p className="editorial-body text-foreground/90">{p}</p>
          </div>
        ))}
      </div>
      <Link
        href={`/story/${item.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Full story →
      </Link>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border/50">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
            World view
          </p>
          <div className="space-y-2">
            {item.howWorldSeesIt.map((w: HowWorldSeesItItem, i: number) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase shrink-0 pt-0.5 w-20">
                  {w.region}
                </span>
                <Link
                  href={`/story/${w.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-snug"
                >
                  {w.summary}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

// Convert a raw source handle/string to a human-readable display name.
// E.g. "YouTube/GlennGreenwald" → "Glenn Greenwald", "glenngreenwald" → "Glenn Greenwald"
function getDisplayName(story: Story): string | null {
  // Prefer the source field (e.g. "YouTube/60 Minutes" → "60 Minutes")
  const src = story.source ?? ''
  const stripped = src.replace(/^(YouTube|TikTok|Reddit)\/(@)?/i, '').trim()
  if (stripped) return stripped
  // Fall back to journalist handle with basic title-casing
  const handle = story.journalist_username ?? ''
  if (!handle) return null
  // Split camelCase handle into words and capitalize each
  return handle
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

function InTheKnowBullet({ item, storyMap }: { item: InTheKnowItem; storyMap: Map<string, Story> }) {
  const story = item.slug ? storyMap.get(item.slug) : null
  const badge = story ? resolvedBadge(story) : null
  const displayName = story ? getDisplayName(story) : null
  const confidence = story ? getConfidenceLabel(story) : null
  const confidenceLabel = confidence ? confidence.charAt(0) + confidence.slice(1).toLowerCase() : null
  const coveredCount = story?.msm_outlet_coverage?.covered?.length ?? 0
  const totalChecked = (story?.msm_outlet_coverage?.covered?.length ?? 0) + (story?.msm_outlet_coverage?.notCovered?.length ?? 0)
  const coverageText = totalChecked > 0 ? `${coveredCount} of ${totalChecked} outlets` : null
  const hasMetadata = displayName || badge?.sourceType || confidenceLabel || coverageText

  const inner = <span className="text-[1.0rem] leading-relaxed">{item.text}</span>
  return (
    <li className="py-3 border-b border-border/50 last:border-0">
      <div className="flex gap-2">
        <span className="text-muted-foreground shrink-0 mt-0.5">›</span>
        <div className="flex flex-col gap-2">
          {item.slug ? (
            <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
              {inner}
            </Link>
          ) : inner}
          {hasMetadata && (
            <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {displayName && (
                <span className="font-semibold text-foreground/70">{displayName}</span>
              )}
              {displayName && badge?.sourceType && <span className="opacity-40">·</span>}
              {badge?.sourceType && (
                <span>{badge.sourceType}{badge.tier ? ` (Tier ${badge.tier})` : ''}</span>
              )}
              {(displayName || badge?.sourceType) && confidenceLabel && <span className="opacity-40">·</span>}
              {confidenceLabel && (
                <span className="italic">{confidenceLabel}</span>
              )}
              {(displayName || badge?.sourceType || confidenceLabel) && coverageText && <span className="opacity-40">·</span>}
              {coverageText && (
                <span>{coverageText}</span>
              )}
              {story?.msm_gap && (
                <span
                  className="font-semibold text-[oklch(0.45_0.22_24)]"
                  title="Limited Coverage: This story is receiving attention from fewer than 3 of 15 tracked mainstream outlets"
                >
                  Limited Coverage
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

function DigestView({ content, date, storyMap }: { content: DigestContent; date: string; storyMap: Map<string, Story> }) {
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
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
            <div key={item.slug}>
              <NeedToKnowStory item={item} storyMap={storyMap} />
              {i === 0 && content.needToKnow.length > 1 && (
                <div className="py-4 px-1 border-t border-border/40">
                  <EmailCaptureInline placement="post-ntk" />
                </div>
              )}
            </div>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-border/40" />
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase shrink-0">
              Also worth knowing
            </span>
            <div className="flex-1 border-t border-border/40" />
          </div>
          <ul className="space-y-2 bg-muted/30 rounded-lg px-4 py-3">
            {content.etcetera.map((item: EtceteraItem | string, i: number) => {
              const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
              const story = etc.slug ? storyMap.get(etc.slug) : null
              const text = <span className="text-[0.9rem] leading-relaxed text-muted-foreground">{etc.text}</span>
              return (
                <li key={i} className="flex flex-col gap-1 py-1.5 border-b border-border/30 last:border-0">
                  {etc.slug ? (
                    <Link href={`/story/${etc.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                      {text}
                    </Link>
                  ) : text}
                  {story && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SourceTypeBadge tier={resolvedBadge(story).tier} sourceType={resolvedBadge(story).sourceType} />
                      <ConfidenceBadge label={getConfidenceLabel(story)} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Mainstream Pulse */}
      {content.mainstreamPulse && content.mainstreamPulse.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
              Mainstream Pulse
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">What the major outlets are leading with today.</p>
          <Link href="/corrections" className="block text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors mb-3">
            ✓ No corrections today
          </Link>
          <ul className="space-y-2">
            {content.mainstreamPulse.map((item: MainstreamPulseItem, i: number) => {
              const standardizedDescriptor = getOutletDescriptor(item.source)
              return (
              <li key={i} className="flex gap-3 items-baseline py-1.5 border-b border-border/50 last:border-0">
                <div className="shrink-0 w-24">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase block">{item.source}</span>
                  <span className="text-[9px] text-muted-foreground/60 leading-none" title={item.descriptor}>{standardizedDescriptor}</span>
                </div>
                {item.slug ? (
                  <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm leading-relaxed hover:underline underline-offset-2">
                    {item.headline}
                  </Link>
                ) : (
                  <span className="text-sm leading-relaxed">{item.headline}</span>
                )}
              </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Global Blindspot — visual section using world map design */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <GlobalBlindspotSection stories={content.globalBlindspots.map(item => storyMap.get(item.slug)).filter((s): s is Story => !!s)} />
      )}

      {/* Global Blindspot — text fallback for digest items not in storyMap */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <section className="hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_55)] uppercase shrink-0">
              🌍 Global Blindspot
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Stories the rest of the world is covering that haven&apos;t reached US headlines.</p>
          <ul className="space-y-4">
            {content.globalBlindspots.map((item, i) => {
              const story = storyMap.get(item.slug)
              return (
              <li key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{item.region}</span>
                  {story && <SourceTypeBadge tier={resolvedBadge(story).tier} sourceType={resolvedBadge(story).sourceType} />}
                  {story && <ConfidenceBadge label={getConfidenceLabel(story)} />}
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

      {/* Global Lens */}
      {content.globalLens && content.globalLens.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase shrink-0">
              🌍 Global Lens
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">How international outlets are covering today&apos;s stories — perspectives that add context to the US view.</p>
          <div className="space-y-4">
            {content.globalLens.map((item: GlobalLensItem) => {
              const story = storyMap.get(item.slug)
              return (
              <div key={item.slug} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{item.region}</span>
                  {story && <SourceTypeBadge tier={resolvedBadge(story).tier} sourceType={resolvedBadge(story).sourceType} />}
                  {story && <ConfidenceBadge label={getConfidenceLabel(story)} />}
                </div>
                <Link
                  href={`/story/${item.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-foreground hover:underline underline-offset-2 leading-snug block mb-1"
                >
                  {item.title}
                </Link>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </div>
              )
            })}
          </div>
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

function FreshnessLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase mt-4 mb-1 first:mt-0">
      {label}
    </p>
  )
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  return (now.getTime() - date.getTime()) < 24 * 60 * 60 * 1000
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

  // Split voices + stories into today vs earlier for freshness labels
  const allCapped = [...cappedVoices, ...cappedStories]
  const todayItems = allCapped.filter(s => isToday(s.created_at))
  const earlierItems = allCapped.filter(s => !isToday(s.created_at))
  const showFreshnessLabels = todayItems.length > 0 && earlierItems.length > 0
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
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
          {allCapped.length > 0 && (
            <>
              {showFreshnessLabels ? (
                <>
                  <FreshnessLabel label="Today" />
                  {todayItems.map(s => <StoryCard key={s.id} story={s} />)}
                  <FreshnessLabel label="Earlier this week" />
                  {earlierItems.map(s => <StoryCard key={s.id} story={s} />)}
                </>
              ) : (
                allCapped.map(s => <StoryCard key={s.id} story={s} />)
              )}
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

  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [digest, usResult, regionalResult] = await Promise.all([
    getLatestDigest(),
    supabase
      .from('stories')
      .select('*')
      .eq('published', true)
      .is('region', null)
      .gte('created_at', sevenDaysAgo)
      .order('pinned', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('stories')
      .select('*')
      .eq('published', true)
      .not('region', 'is', null)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const all = [
    ...((usResult.data as Story[]) ?? []),
    ...((regionalResult.data as Story[]) ?? []),
  ]
  const storyMap = new Map(all.map(s => [s.slug, s]))

  // Supplement storyMap with any digest-referenced stories not in the 7-day window
  if (digest) {
    const digestSlugs: string[] = [
      ...digest.content.needToKnow.map(i => i.slug),
      ...Object.values(digest.content.inTheKnow).flatMap(items => items.map(i => i.slug).filter(Boolean) as string[]),
      ...(digest.content.etcetera ?? []).map(i => typeof i === 'string' ? null : i.slug).filter(Boolean) as string[],
      ...(digest.content.globalBlindspots ?? []).map(i => i.slug),
    ]
    const missingSlugs = [...new Set(digestSlugs)].filter(slug => !storyMap.has(slug))
    if (missingSlugs.length > 0) {
      const { data: extra } = await supabase.from('stories').select('*').in('slug', missingSlugs)
      for (const s of (extra ?? []) as Story[]) storyMap.set(s.slug, s)
    }
  }

  // Default to digest view when one exists, unless user explicitly chose clips
  const activeView = view === 'clips' ? 'clips' : (digest ? 'digest' : 'clips')

  function splitSection(category: 'raw' | 'reported' | 'analysis') {
    const section = all.filter(s => s.category === category && !s.region)
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

        {/* Hero — world map + top story */}
        {(() => {
          const heroStory = all.find(s => s.pinned) ?? all[0]
          return heroStory ? <HeroStory story={heroStory} /> : (
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Top News Clips</h1>
              <p className="text-sm text-muted-foreground mt-1">The full picture, not the profitable picture.</p>
            </div>
          )
        })()}
        <EmailCaptureInline placement="hero" />
        {digest && activeView === 'digest' && (
          <a href="#digest" className="inline-block mt-3 mb-4 text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2">
            See today&apos;s digest ↓
          </a>
        )}

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
          <div id="digest">
            <DigestView content={digest.content} date={digest.date} storyMap={storyMap} />
          </div>
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
              <GlobalBlindspotSection stories={globalBlindspots} />
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
                            <SourceTypeBadge tier={resolvedBadge(s).tier} sourceType={resolvedBadge(s).sourceType} />
                          </div>
                          <Link href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
                            <h3 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2">{s.title}</h3>
                          </Link>
                          {s.description && (
                            <p className="text-base text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <PressureScore viewCount={s.view_count} shareCount={s.share_count} />
                            <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                            <a href={`/story/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto py-1 px-0.5 -my-1">Full story →</a>
                          </div>
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
              accentClass="text-[oklch(0.52_0.14_196)]"
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
