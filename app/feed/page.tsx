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
import SourceBadge from '@/components/SourceBadge'
import HeroStory from '@/components/HeroStory'
import GlobalBlindspotSection from '@/components/GlobalBlindspotSection'
import GlobalLensSection from '@/components/GlobalLensSection'
import SectionHeader, { VARIANT_CONFIG } from '@/components/SectionHeader'
import SectionCard from '@/components/SectionCard'
import WorldMapSection from '@/components/WorldMapSection'
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
    <article className="rounded-xl p-4 mb-3 last:mb-0" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #3b82f6' }}>
      {(hasAttribution || story?.msm_gap) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {(badge?.tier || badge?.sourceType) && <SourceBadge tier={badge.tier} sourceType={badge.sourceType} />}
          {story && <ConfidenceBadge label={getConfidenceLabel(story)} />}
          {story?.journalist_username && (
            <span className="text-xs text-white/40">@{story.journalist_username}</span>
          )}
          {story?.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
        </div>
      )}
      <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="group block mb-3">
        <h2 className="text-2xl font-black tracking-tight leading-snug text-white group-hover:underline underline-offset-2">
          {item.sectionTitle}
        </h2>
      </Link>
      <div className="space-y-4">
        {item.paragraphs.slice(0, 2).map((p, i) => (
          <div key={i}>
            <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">
              {PARA_LABELS[i]}
            </p>
            <p className="editorial-body text-white/80">{p}</p>
          </div>
        ))}
      </div>
      <Link
        href={`/story/${item.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs font-semibold text-white/50 hover:text-white transition-colors"
      >
        Full story →
      </Link>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-3">
            World view
          </p>
          <div className="space-y-2">
            {item.howWorldSeesIt.map((w: HowWorldSeesItItem, i: number) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase shrink-0 pt-0.5 w-20">
                  {w.region}
                </span>
                <Link
                  href={`/story/${w.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/60 hover:text-white transition-colors leading-snug"
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

// Per-category config for In The Know
const ITK_CATEGORY_CONFIG: Record<string, { color: string; icon: string; subtitle: string }> = {
  'Politics & World Affairs':        { color: '#3b82f6', icon: '🌐', subtitle: 'What\'s moving in politics and around the world' },
  'Science & Technology':            { color: '#a855f7', icon: '🔬', subtitle: 'Discoveries, breakthroughs, and what\'s changing fast' },
  'Business & Markets':              { color: '#22c55e', icon: '📈', subtitle: 'Economic signals, market moves, and industry shifts' },
  'Sports, Entertainment, & Culture':{ color: '#f97316', icon: '🎭', subtitle: 'Sports, culture, and the stories people are talking about' },
  'Comedy & Satire':                 { color: '#eab308', icon: '🎤', subtitle: 'The week in news — through a different lens' },
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
      <p className="text-xs font-bold tracking-widest text-white/40 uppercase mb-6">
        {formattedDate}
      </p>

      {/* Need To Know */}
      <WorldMapSection
        title="Need To Know" icon="📌" accent="#3b82f6" mapMode="hero"
        subtitle="The stories that matter most today — verified, sourced, in context"
        stories={[]}
        footer={
          <div className="divide-y divide-white/10 -mt-2">
            {content.needToKnow.map((item, i) => (
              <div key={item.slug}>
                <NeedToKnowStory item={item} storyMap={storyMap} />
                {i === 0 && content.needToKnow.length > 1 && (
                  <div className="py-4 border-t border-white/10">
                    <EmailCaptureInline placement="post-ntk" />
                  </div>
                )}
              </div>
            ))}
          </div>
        }
      />

      {/* In The Know — one WorldMapSection per category */}
      {IN_THE_KNOW_CATEGORIES.map((cat) => {
        const items = content.inTheKnow[cat]
        if (!items?.length) return null
        const cfg = ITK_CATEGORY_CONFIG[cat] ?? { color: '#3b82f6', icon: '📌' }
        // Resolve Story objects for each item, filtering out missing ones
        const stories = items
          .filter(item => item.slug)
          .map(item => storyMap.get(item.slug!))
          .filter((s): s is Story => !!s)
        return (
          <WorldMapSection
            key={cat}
            title={cat}
            icon={cfg.icon}
            accent={cfg.color}
            mapMode="hero"
            stories={stories}
            subtitle={cfg.subtitle}
          />
        )
      })}

      {/* Etcetera */}
      {content.etcetera?.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#64748b' }} />
          <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase mb-5 block text-white/40">··· Also Worth Knowing</span>
          <ul className="space-y-2 rounded-lg px-2 py-1">
            {content.etcetera.map((item: EtceteraItem | string, i: number) => {
              const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
              const story = etc.slug ? storyMap.get(etc.slug) : null
              const text = <span className="text-[0.9rem] leading-relaxed text-white/70">{etc.text}</span>
              return (
                <li key={i} className="flex flex-col gap-1 px-3 py-2.5 rounded-xl mb-2 last:mb-0" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: '3px solid #64748b' }}>
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
          </div>
        </div>
      )}

      {/* Mainstream Pulse */}
      {content.mainstreamPulse && content.mainstreamPulse.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#94a3b8' }} />
          <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5 block text-[#94a3b8]">📺 Mainstream Pulse</span>
          <p className="text-xs text-white/50 mb-4">What the major outlets are leading with today</p>
          <Link href="/corrections" className="block text-[10px] text-white/40 hover:text-white/80 transition-colors mb-3">
            ✓ No corrections today
          </Link>
          <ul className="space-y-2">
            {content.mainstreamPulse.map((item: MainstreamPulseItem, i: number) => {
              const standardizedDescriptor = getOutletDescriptor(item.source)
              return (
              <li key={i} className="group flex gap-3 items-start py-2.5 px-3 rounded-xl mb-2 last:mb-0 transition-colors" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: '3px solid #94a3b8' }}>
                <div className="shrink-0 w-20 pt-0.5">
                  <span className="text-[11px] font-bold text-white/80 block leading-tight">{item.source}</span>
                  <span className="text-[9px] text-white/30 leading-none italic" title={item.descriptor}>{standardizedDescriptor}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {item.slug ? (
                    <Link href={`/story/${item.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm leading-snug text-white/80 hover:text-white hover:underline underline-offset-2 font-medium transition-colors">
                      {item.headline}
                    </Link>
                  ) : (
                    <span className="text-sm leading-snug font-medium text-white/60">{item.headline}</span>
                  )}
                </div>
              </li>
              )
            })}
          </ul>
          </div>
        </div>
      )}

      {/* Global Blindspot — visual section using world map design */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <GlobalBlindspotSection stories={content.globalBlindspots.map(item => storyMap.get(item.slug)).filter((s): s is Story => !!s)} />
      )}


      {/* Global Lens */}
      {content.globalLens && content.globalLens.length > 0 && (
        <GlobalLensSection items={content.globalLens} storyMap={storyMap} />
      )}
    </div>
  )
}

// ─── Clips components (existing view) ────────────────────────────────────────

function SubHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold tracking-widest text-white/40 uppercase mt-5 mb-2">
      {label}
    </p>
  )
}

function FreshnessLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase mt-4 mb-2 first:mt-0">
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

const SECTION_VARIANT_MAP: Record<string, 'analysis' | 'reported' | 'raw' | 'in-the-know'> = {
  'Analysis':    'analysis',
  'Reported':    'reported',
  'Raw Footage': 'raw',
}

interface SectionProps {
  title: string
  subtitle: string
  categorySlug?: string
  pinned: Story[]
  voices: Story[]
  stories: Story[]
  accentClass: string
}

const SECTION_CONFIG: Record<string, { accent: string; icon: string; mapMode: 'hero' | 'blindspot' }> = {
  'Analysis':    { accent: '#f59e0b', icon: '🧠', mapMode: 'hero' },
  'Reported':    { accent: '#22c55e', icon: '🔬', mapMode: 'hero' },
  'Raw Footage': { accent: '#94a3b8', icon: '📹', mapMode: 'hero' },
  'Latest':      { accent: '#3b82f6', icon: '📡', mapMode: 'hero' },
}

function Section({ title, subtitle, categorySlug, pinned, voices, stories }: SectionProps) {
  let voicesBudget = Math.max(0, SECTION_CAP - pinned.length)
  const cappedVoices = voices.slice(0, voicesBudget)
  voicesBudget = Math.max(0, voicesBudget - cappedVoices.length)
  const cappedStories = stories.slice(0, voicesBudget)
  const allStories = [...pinned, ...cappedVoices, ...cappedStories]

  const cfg = SECTION_CONFIG[title] ?? { accent: '#3b82f6', icon: '📌', mapMode: 'hero' as const }

  return (
    <WorldMapSection
      title={title}
      subtitle={subtitle}
      icon={cfg.icon}
      accent={cfg.accent}
      mapMode={cfg.mapMode}
      stories={allStories}
      seeAllHref={categorySlug ? `/category/${categorySlug}` : undefined}
    />
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
          <div className="flex rounded-xl overflow-hidden mb-6 text-sm font-semibold" style={{ background: '#0d1628', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Link
              href="/feed"
              className={`flex-1 text-center py-3 transition-all ${
                activeView === 'digest'
                  ? 'text-white font-bold'
                  : 'text-white/40 hover:text-white/70'
              }`}
              style={activeView === 'digest' ? { background: 'rgba(59,130,246,0.15)', borderBottom: '2px solid #3b82f6' } : {}}
            >
              📋 Digest
            </Link>
            <Link
              href="/feed?view=clips"
              className={`flex-1 text-center py-3 transition-all border-l border-white/10 ${
                activeView === 'clips'
                  ? 'text-white font-bold'
                  : 'text-white/40 hover:text-white/70'
              }`}
              style={activeView === 'clips' ? { background: 'rgba(59,130,246,0.15)', borderBottom: '2px solid #3b82f6' } : {}}
            >
              🎬 All Clips
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
                href="/feed"
                className="block mb-6 p-5 rounded-xl group transition-opacity hover:opacity-90"
                style={{ background: '#0d1628', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <p className="text-[10px] font-bold tracking-[0.15em] text-[#3b82f6] uppercase mb-2">
                  📋 Today&apos;s Digest
                </p>
                <p className="text-base font-bold leading-snug text-white group-hover:underline underline-offset-2 mb-1">
                  {digest.content.needToKnow[0]?.sectionTitle}
                </p>
                <p className="text-sm text-white/50 line-clamp-2">
                  {digest.content.needToKnow[0]?.paragraphs[0]}
                </p>
                <p className="text-xs font-semibold mt-3 text-[#3b82f6]">
                  Read full digest →
                </p>
              </Link>
            )}
            {msmBlackout.length > 0 && (
              <WorldMapSection
                title="Limited Coverage" icon="⚠️" accent="#ef4444" mapMode="blindspot"
                subtitle="Stories receiving little attention from mainstream outlets"
                stories={msmBlackout.slice(0, 6)}
              />
            )}
            {globalBlindspots.length > 0 && (
              <GlobalBlindspotSection stories={globalBlindspots} />
            )}
            {globalLens.length > 0 && (
              <GlobalLensSection stories={globalLens} />
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
