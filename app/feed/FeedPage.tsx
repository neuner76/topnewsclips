import { createPublicClient } from '@/lib/supabase/server'
import { getLatestDigest } from '@/lib/digest'
import type { DigestContent, NeedToKnowItem, EtceteraItem, HowWorldSeesItItem, MainstreamPulseItem } from '@/lib/digest'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import TierBadge from '@/components/TierBadge'
import GlobalBlindspotSection from '@/components/GlobalBlindspotSection'
import GlobalLensSection from '@/components/GlobalLensSection'
import WorldMapSection from '@/components/WorldMapSection'
import TrackEvent from '@/components/TrackEvent'
import Link from 'next/link'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'
import { getOutletDescriptor } from '@/lib/outlet-descriptors'
import ConfidenceBadge from '@/components/ConfidenceBadge'
import MSMBadge from '@/components/MSMBadge'
import FeedStoryLink from '@/components/FeedStoryLink'
import {
  coverageCount,
  coverageText,
  displaySummary,
  emergingSignalCopy,
  isLimitedSourceNeedToKnow,
  isWeakPrimarySingleton,
} from '@/lib/feed-editorial'
import {
  buildDigestEdition,
  CANONICAL_IN_THE_KNOW_SECTIONS,
  deriveMainstreamPulseSynthesis,
  DIGEST_SECTION_LIMITS,
  validateDigestEdition,
} from '@/lib/digest-canonical'


// ─── Digest components ───────────────────────────────────────────────────────

/**
 * Compute source tier for display. Fresh computation takes priority (fixes stale DB values
 * from before taxonomy corrections). Exception: if the static lookup returns null or the
 * generic Tier 7 handle catch-all, fall back to the DB-stored tier, this covers
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

function getStoryCautionNote(story: Story): string | null {
  const confidence = getConfidenceLabel(story)
  const text = `${story.title} ${story.description ?? ''}`.toLowerCase()
  const fluidPattern = /\b(war|military|strike|missile|diplomacy|ceasefire|conflict|iran|israel|ukraine|russia|gaza|hormuz|nuclear)\b/
  if (confidence === 'DEVELOPING' || fluidPattern.test(text)) return 'Developing story - details may change'
  if ((confidence === 'REPORTED' || confidence === 'CORROBORATED') && coverageCount(story) < 3) {
    return 'Reported by limited sources - follow-up expected'
  }
  return null
}

function NeedToKnowStory({ item, storyMap, position }: { item: NeedToKnowItem; storyMap: Map<string, Story>; position: number }) {
  const story = storyMap.get(item.slug)
  const badge = story ? resolvedBadge(story) : null
  const hasAttribution = badge?.tier || badge?.sourceType || story?.journalist_username
  const confidence = story ? getConfidenceLabel(story) : null
  const cautionNote = story ? getStoryCautionNote(story) : null
  const emergingSignal = story ? isLimitedSourceNeedToKnow(story, 'Need To Know') : false
  const treatment = emergingSignal ? 'emerging_signal' : 'standard'
  return (
    <article className="rounded-xl p-4 mb-3 last:mb-0" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #3b82f6' }}>
      {emergingSignal && story && (
        <TrackEvent name="feed_emerging_signal_impression" properties={{ story_slug: story.slug, section: 'Need To Know', position, coverage_count: coverageCount(story), coverage_total: story.msm_outlet_coverage ? story.msm_outlet_coverage.covered.length + story.msm_outlet_coverage.notCovered.length : 15, source_type: badge?.sourceType, source_tier: badge?.tier, confidence, treatment }} />
      )}
      {(hasAttribution || story?.msm_gap) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {emergingSignal && (
            <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-400/30 text-amber-200/90">
              Emerging signal
            </span>
          )}
          {(badge?.tier || badge?.sourceType) && <TierBadge tier={badge.tier} sourceType={badge.sourceType} />}
          {story && <ConfidenceBadge label={confidence} category={story.category} />}
          {story && <span className="text-[10px] text-white/30">{coverageText(story)}</span>}
          {story?.journalist_username && (
            <span className="text-xs text-white/40">@{story.journalist_username}</span>
          )}
          {story?.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
        </div>
      )}
      <FeedStoryLink
        href={`/story/${item.slug}`}
        event={emergingSignal ? 'feed_emerging_signal_click' : 'feed_story_click'}
        properties={{
          section: 'Need To Know',
          story_slug: item.slug,
          source_type: badge?.sourceType,
          source_tier: badge?.tier,
          confidence,
          coverage_count: story ? coverageCount(story) : null,
          position,
          is_lower_confidence: false,
          treatment,
        }}
        className="group block mb-3"
      >
        <h2 className="text-2xl font-black tracking-tight leading-snug text-white group-hover:underline underline-offset-2">
          {item.sectionTitle}
        </h2>
      </FeedStoryLink>
      <div className="space-y-4">
        {item.paragraphs.slice(0, 2).map((p, i) => (
          <div key={i}>
            <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">
              {PARA_LABELS[i]}
            </p>
            <p className="editorial-body text-white/80">{displaySummary(p, i === 0 ? 65 : 55)}</p>
          </div>
        ))}
      </div>
      {emergingSignal && (
        <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100/75">
          {emergingSignalCopy(position - 1)}
        </p>
      )}
      {cautionNote && (
        <p className="mt-3 text-[11px] text-white/40">{cautionNote}</p>
      )}
      <FeedStoryLink
        href={`/story/${item.slug}`}
        event="feed_full_story_click"
        properties={{
          section: 'Need To Know',
          story_slug: item.slug,
          source_type: badge?.sourceType,
          source_tier: badge?.tier,
          confidence,
          coverage_count: story ? coverageCount(story) : null,
          position,
          is_lower_confidence: false,
          treatment,
        }}
        className="inline-block mt-4 text-xs font-semibold text-white/50 hover:text-white transition-colors"
      >
        Full story →
      </FeedStoryLink>
      {item.howWorldSeesIt && item.howWorldSeesIt.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-3">
            World view
          </p>
          <div className="space-y-2">
            {item.howWorldSeesIt.slice(0, 2).map((w: HowWorldSeesItItem, i: number) => (
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
                  {displaySummary(w.summary, 40)}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

// Per-category config for In The Know
const ITK_CATEGORY_CONFIG: Record<string, { color: string; icon: string; subtitle: string }> = {
  'Politics & World Affairs':        { color: '#3b82f6', icon: '🌐', subtitle: 'What\'s moving in politics and around the world' },
  'Science, Health & Environment':   { color: '#a855f7', icon: '🔬', subtitle: 'Science, health, climate, and environmental shifts' },
  'Business & Markets':              { color: '#22c55e', icon: '📈', subtitle: 'Economic signals, market moves, and industry shifts' },
  'Culture, Media & Society':        { color: '#f97316', icon: '🎭', subtitle: 'Culture, media, sports, and social stories people are talking about' },
}

function DigestView({ content, date, storyMap }: { content: DigestContent; date: string; storyMap: Map<string, Story> }) {
  const edition = buildDigestEdition({ id: `feed-${date}`, date, content, generated_at: '' }, storyMap, 'https://www.topnewsclips.com')
  const validation = validateDigestEdition(edition)
  if (validation.errors.length > 0 || validation.warnings.length > 0) {
    console.warn('[feed] canonical digest validation', validation)
  }
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  })
  const categoryBlocks = CANONICAL_IN_THE_KNOW_SECTIONS.map(({ name, sourceKeys }) => {
    const items = sourceKeys.flatMap(key => content.inTheKnow[key] ?? [])
    const cfg = ITK_CATEGORY_CONFIG[name] ?? { color: '#3b82f6', icon: '📌', subtitle: '' }
    const stories = items
      .filter(item => item.slug)
      .map(item => storyMap.get(item.slug!))
      .filter((s): s is Story => !!s)
    const shouldReassignSingleton = stories.length === 1 && isWeakPrimarySingleton(stories[0], resolvedBadge(stories[0]).sourceType)
    return { cat: name, items, cfg, stories, shouldReassignSingleton }
  })
  const reassignedEtcetera: Array<EtceteraItem & { originalSection: string }> = categoryBlocks
    .filter(block => block.shouldReassignSingleton)
    .map(block => {
      const item = block.items.find(i => i.slug === block.stories[0]?.slug)
      return {
        slug: block.stories[0].slug,
        text: item?.text ?? block.stories[0].title,
        originalSection: block.cat,
      }
    })
  const etceteraItems: Array<EtceteraItem | string> = [
    ...reassignedEtcetera,
    ...(content.etcetera ?? []),
  ]

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
        subtitle="The stories that matter most today, verified, sourced, in context"
        stories={[]}
        footer={
          <div className="divide-y divide-white/10 -mt-2">
            {content.needToKnow.map((item, i) => (
              <div key={item.slug}>
                <NeedToKnowStory item={item} storyMap={storyMap} position={i + 1} />
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

      {/* In The Know, one WorldMapSection per category */}
      {categoryBlocks.map(({ cat, cfg, stories, shouldReassignSingleton }) => {
        if (!stories.length || shouldReassignSingleton) return null
        const cap = DIGEST_SECTION_LIMITS[cat] ?? 4
        const isCapped = stories.length > cap
        const shownStories = isCapped ? stories.slice(0, cap) : stories
        return (
          <WorldMapSection
            key={cat}
            title={cat}
            icon={cfg.icon}
            accent={cfg.color}
            mapMode="hero"
            stories={shownStories}
            subtitle={cfg.subtitle}
            seeAllHref={isCapped ? '/stories' : undefined}
          />
        )
      })}

      {/* Etcetera */}
      {etceteraItems.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}>
          <TrackEvent name="feed_section_impression" properties={{ section: 'Also Worth Knowing', story_count: Math.min(etceteraItems.length, 3) }} />
          <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#64748b' }} />
          <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5 block text-white/40">··· Also Worth Knowing</span>
          <p className="text-xs text-white/45 mb-4">Lower-stakes stories and visual moments from the wider news cycle.</p>
          <ul className="space-y-2 rounded-lg px-2 py-1">
            {etceteraItems.slice(0, 3).map((item: EtceteraItem | string, i: number) => {
              const etc: EtceteraItem = typeof item === 'string' ? { text: item, slug: null } : item
              const story = etc.slug ? storyMap.get(etc.slug) : null
              const badge = story ? resolvedBadge(story) : null
              const confidence = story ? getConfidenceLabel(story) : null
              const reassigned = story ? reassignedEtcetera.find(reassignedItem => reassignedItem.slug === story.slug) : null
              const text = <span className="text-[0.84rem] leading-relaxed text-white/62">{displaySummary(etc.text, 34)}</span>
              return (
                <li key={i} className="flex flex-col gap-1 px-3 py-2.5 rounded-xl mb-2 last:mb-0" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.045)', borderLeft: '3px solid #64748b' }}>
                  {reassigned && story && (
                    <TrackEvent name="feed_story_reassigned_section" properties={{ story_slug: story.slug, original_section: reassigned.originalSection, final_section: 'Also Worth Knowing', treatment: 'weak_singleton' }} />
                  )}
                  {etc.slug ? (
                    <FeedStoryLink
                      href={`/story/${etc.slug}`}
                      properties={{
                        section: 'Also Worth Knowing',
                        story_slug: etc.slug,
                        source_type: badge?.sourceType,
                        source_tier: badge?.tier,
                        confidence,
                        coverage_count: story ? coverageCount(story) : null,
                        position: i + 1,
                        is_lower_confidence: true,
                      }}
                      className="hover:underline underline-offset-2"
                    >
                      {text}
                    </FeedStoryLink>
                  ) : text}
                  {story && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TierBadge tier={badge?.tier ?? null} sourceType={badge?.sourceType ?? null} />
                      <ConfidenceBadge label={confidence} category={story.category} />
                      <span className="text-[10px] text-white/30">{coverageText(story)}</span>
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
          <p className="text-xs text-white/50 mb-1.5">What major U.S. outlets are leading with today.</p>
          <p className="text-sm text-white/60 mb-3 leading-relaxed">{deriveMainstreamPulseSynthesis(content.mainstreamPulse)}</p>
          <p className="text-[11px] text-white/35 mb-4 italic">Headline selections from major tracked outlets — not TopNewsClips endorsements.</p>
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
                  ) : item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm leading-snug text-white/80 hover:text-white hover:underline underline-offset-2 font-medium transition-colors">
                      {item.headline}
                    </a>
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

      {/* Global Blindspot, visual section using world map design */}
      {content.globalBlindspots && content.globalBlindspots.length > 0 && (
        <GlobalBlindspotSection stories={content.globalBlindspots.map(item => storyMap.get(item.slug)).filter((s): s is Story => !!s)} layout="list" />
      )}


      {/* Global Lens */}
      {content.globalLens && content.globalLens.length > 0 && (
        <GlobalLensSection items={content.globalLens} storyMap={storyMap} layout="list" />
      )}
    </div>
  )
}

const SECTION_CAP = 6
const HIDDEN_STORY_SLUGS = new Set([
  'tiktok-7395615642138791210',
])

interface LaneProps {
  title: string
  subtitle: string
  categorySlug?: string
  stories: Story[]
}

const LANE_CONFIG: Record<string, { accent: string; icon: string; mapMode: 'hero' | 'blindspot' }> = {
  'Verified Reporting':  { accent: '#22c55e', icon: '✅', mapMode: 'hero' },
  'Context / Analysis':  { accent: '#f59e0b', icon: '🧠', mapMode: 'hero' },
  'Raw Footage':         { accent: '#94a3b8', icon: '📹', mapMode: 'hero' },
  'More Clips':          { accent: '#3b82f6', icon: '📡', mapMode: 'hero' },
  'Limited Coverage':    { accent: '#ef4444', icon: '⚠️', mapMode: 'blindspot' },
}

function Lane({ title, subtitle, categorySlug, stories }: LaneProps) {
  if (stories.length === 0) return null
  const cfg = LANE_CONFIG[title] ?? { accent: '#3b82f6', icon: '📌', mapMode: 'hero' as const }

  return (
    <WorldMapSection
      title={title}
      subtitle={subtitle}
      icon={cfg.icon}
      accent={cfg.accent}
      mapMode={cfg.mapMode}
      stories={stories}
      seeAllHref={categorySlug ? `/category/${categorySlug}` : undefined}
      layout="grid"
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function FeedPage({ preferredView }: { preferredView: 'digest' | 'clips' }) {
  const supabase = createPublicClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

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
  ].filter(story => !HIDDEN_STORY_SLUGS.has(story.slug))
  const storyMap = new Map(all.map(s => [s.slug, s]))

  // Supplement storyMap with any digest-referenced stories not in the 7-day window
  if (digest) {
    const digestSlugs: string[] = [
      ...digest.content.needToKnow.map(i => i.slug),
      ...Object.values(digest.content.inTheKnow).flatMap(items => items.map(i => i.slug).filter(Boolean) as string[]),
      ...(digest.content.etcetera ?? []).map(i => typeof i === 'string' ? null : i.slug).filter(Boolean) as string[],
      ...(digest.content.globalBlindspots ?? []).map(i => i.slug),
      ...(digest.content.globalLens ?? []).map(i => i.slug),
    ]
    const missingSlugs = [...new Set(digestSlugs)].filter(slug => !storyMap.has(slug))
    if (missingSlugs.length > 0) {
      const { data: extra } = await supabase.from('stories').select('*').in('slug', missingSlugs)
      for (const s of (extra ?? []) as Story[]) storyMap.set(s.slug, s)
    }
  }

  // Default to digest view when one exists, unless user explicitly chose clips
  const activeView = preferredView === 'clips' ? 'clips' : (digest ? 'digest' : 'clips')

  // Cap any single journalist/channel at 2 stories per lane, pinned stories first
  function curateLane(stories: Story[]): Story[] {
    const sorted = [...stories].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
    const channelCounts = new Map<string, number>()
    const capped = sorted.filter(s => {
      if (!s.journalist_username) return true
      const n = channelCounts.get(s.journalist_username) ?? 0
      if (n >= 2) return false
      channelCounts.set(s.journalist_username, n + 1)
      return true
    })
    return capped.slice(0, SECTION_CAP)
  }

  // Clips lanes — Limited Coverage takes priority over every other lane,
  // regardless of category or tier.
  const limitedCoverage = curateLane(all.filter(s => coverageCount(s) < 3))
  const limitedSlugs = new Set(limitedCoverage.map(s => s.id))

  const verifiedReporting: Story[] = []
  const contextAnalysis: Story[] = []
  const rawFootage: Story[] = []
  const moreClips: Story[] = []
  for (const s of all) {
    if (limitedSlugs.has(s.id)) continue
    const { tier } = resolvedBadge(s)
    if (tier !== null && tier <= 6 && (s.category === 'reported' || s.category === 'analysis')) {
      verifiedReporting.push(s)
    } else if (tier === 7 && s.category === 'analysis') {
      contextAnalysis.push(s)
    } else if (tier === 9) {
      rawFootage.push(s)
    } else {
      moreClips.push(s)
    }
  }

  // Global Lens, one top story per region, excluding Blindspot stories
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

        {/* Hero + email capture — Clips view only; the Digest view jumps straight into headlines */}
        {activeView !== 'digest' && <EmailCaptureInline placement="hero" />}

        {/* Tab switcher */}
        {digest && (
          <div className="flex rounded-xl overflow-hidden mb-6" style={{ background: '#0d1628', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Link
              href="/feed"
              className={`flex-1 text-center px-4 py-3 transition-all ${
                activeView === 'digest' ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={activeView === 'digest' ? { background: 'rgba(59,130,246,0.15)', borderBottom: '2px solid #3b82f6' } : {}}
            >
              <div className="text-sm font-bold">📋 Digest</div>
              <div className="text-[10px] text-white/40 mt-0.5">Read the day</div>
            </Link>
            <Link
              href="/feed/clips"
              className={`flex-1 text-center px-4 py-3 transition-all border-l border-white/10 ${
                activeView === 'clips' ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={activeView === 'clips' ? { background: 'rgba(59,130,246,0.15)', borderBottom: '2px solid #3b82f6' } : {}}
            >
              <div className="text-sm font-bold">🎬 Clips</div>
              <div className="text-[10px] text-white/40 mt-0.5">Scan the signal</div>
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
            {/* Clips hero */}
            <div
              className="relative rounded-2xl overflow-hidden mb-6 px-6 py-10 sm:px-10 sm:py-12"
              style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    radial-gradient(ellipse at 70% 40%, rgba(59,130,246,0.14) 0%, transparent 60%),
                    linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)
                  `,
                  backgroundSize: '100% 100%, 48px 48px, 48px 48px',
                }}
              />
              <div className="relative z-10 max-w-lg">
                <p className="text-[11px] font-bold tracking-[0.2em] text-[#3b82f6] uppercase mb-3">
                  🎬 Clips
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
                  See the signal faster.
                </h2>
                <p className="text-base text-white/60 leading-relaxed mb-2">
                  A clip-first view of the news with visible source labels, confidence markers, and undercovered stories worth your attention.
                </p>
                <p className="text-sm text-white/40 mb-6">
                  Scan what&apos;s happening in minutes. Then go deeper when something matters.
                </p>
                {digest && (
                  <Link
                    href="/feed"
                    className="text-sm text-white/40 hover:text-white/70 transition-colors"
                  >
                    Prefer the written version? Read today&apos;s digest →
                  </Link>
                )}
              </div>
            </div>

            {/* Intro: set expectations vs. the digest */}
            <p className="text-xs text-white/40 mb-6">
              Clips are a fast scan of visual signal. For the structured briefing,{' '}
              <Link href="/feed" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
                read the digest
              </Link>.
            </p>

            {/* Why Clips? explainer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { icon: '⚡', title: 'Faster scan', body: 'Important developments in a more visual, lower-friction format.' },
                { icon: '🔬', title: 'Source-aware', body: 'Every clip carries source labels and confidence context, not just headlines.' },
                { icon: '🌍', title: 'Find what others miss', body: 'Limited Coverage, Global Blindspot, and Global Lens surface what your main feed won\'t.' },
              ].map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl px-4 py-4"
                  style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="text-xl mb-2">{icon}</div>
                  <p className="text-sm font-bold text-white mb-1">{title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            {/* Lanes — Verified Reporting always first; raw/limited-coverage never lead */}
            <Lane
              title="Verified Reporting"
              subtitle="Independent and institutional reporting with broad corroboration"
              categorySlug="reported"
              stories={verifiedReporting}
            />
            {globalBlindspots.length > 0 && (
              <GlobalBlindspotSection stories={globalBlindspots} layout="grid" />
            )}
            {globalLens.length > 0 && (
              <GlobalLensSection stories={globalLens} layout="grid" />
            )}
            <Lane
              title="Context / Analysis"
              subtitle="Independent voices making sense of what's happening and why it matters"
              categorySlug="analysis"
              stories={contextAnalysis}
            />
            <Lane
              title="Raw Footage"
              subtitle="Bodycam, dashcam, security cam, bystander video, unfiltered and unedited"
              categorySlug="raw"
              stories={rawFootage}
            />
            <Lane
              title="Limited Coverage"
              subtitle="Fewer than 3 outlets have covered these stories so far"
              stories={limitedCoverage}
            />
            <Lane
              title="More Clips"
              subtitle="Other stories from the wider feed"
              stories={moreClips}
            />
          </div>
        )}

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
