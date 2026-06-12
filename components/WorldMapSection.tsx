import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierBadge from './TierBadge'
import CategoryBadge from './CategoryBadge'
import MSMBadge from './MSMBadge'
import ConfidenceBadge from './ConfidenceBadge'
import FeedStoryLink from './FeedStoryLink'
import TrackEvent from './TrackEvent'
import { getConfidenceLabel } from '@/lib/confidence'

interface WorldMapSectionProps {
  title: string
  subtitle?: string
  icon: string
  accent: string
  mapMode?: 'hero' | 'watermark' | 'blindspot'
  stories: Story[]
  seeAllHref?: string
  emptyMessage?: string
  footer?: React.ReactNode
  /** 'grid' = thumbnail above headline (clips); 'list' = text-only rows (digest) */
  layout?: 'grid' | 'list'
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function storyThumbnail(s: Story): string | null {
  return s.platform === 'youtube' ? getYouTubeThumbnail(s.embed_url) : s.thumbnail_url ?? null
}

function formatPublishedDate(dateStr: string): string {
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

function coverageCount(story: Story): number {
  return story.msm_outlet_coverage?.covered?.length ?? 0
}

function coverageText(story: Story): string {
  const covered = coverageCount(story)
  const total = (story.msm_outlet_coverage?.covered?.length ?? 0) + (story.msm_outlet_coverage?.notCovered?.length ?? 0)
  return total > 0 ? `${covered} of ${total} outlets` : 'Coverage pending'
}

function isLowerConfidenceStory(story: Story, sourceType: string | null): boolean {
  const confidence = getConfidenceLabel(story)
  return (
    confidence === 'SINGLE-SOURCE' ||
    sourceType === 'Raw Footage' ||
    sourceType === 'Community Sourced' ||
    coverageCount(story) === 0
  )
}

function sectionSortScore(story: Story): number {
  const { sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
  const confidence = getConfidenceLabel(story)
  let score = 0
  if (confidence === 'CORROBORATED') score += 3
  if (confidence === 'REPORTED') score += 2
  if (confidence === 'ANALYSIS') score += 1
  if (sourceType === 'Community Sourced') score -= 2
  if (sourceType === 'Raw Footage') score -= 2
  if (coverageCount(story) >= 3) score += 1
  return score
}

function orderedStories(title: string, stories: Story[]): Story[] {
  if (title !== 'Politics & World Affairs') return stories
  return [...stories].sort((a, b) => sectionSortScore(b) - sectionSortScore(a))
}

export default function WorldMapSection({
  title, subtitle, icon, accent, mapMode = 'hero',
  stories, seeAllHref, footer, layout = 'list',
}: WorldMapSectionProps) {
  const displayStories = orderedStories(title, stories)
  return (
    <section
      className="relative rounded-2xl overflow-hidden mb-8"
      data-map-mode={mapMode}
      style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <TrackEvent name="feed_section_impression" properties={{ section: title, story_count: displayStories.length }} />
      {/* CSS globe grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 70% 40%, ${accent}18 0%, transparent 60%),
            radial-gradient(ellipse at 20% 80%, ${accent}08 0%, transparent 50%),
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0d1628bb] via-transparent to-[#0d162888]" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0d1628] via-transparent to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: accent }} />

      {/* Content */}
      <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: accent }}>
                {icon} {title}
              </span>
              {subtitle && (
                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {subtitle}
                </h2>
              )}
            </div>
            {seeAllHref && (
              <Link href={seeAllHref} className="text-xs font-semibold shrink-0 ml-4 mt-1 transition-opacity hover:opacity-70" style={{ color: accent }}>
                See all →
              </Link>
            )}
          </div>
        </div>

        {/* Stories */}
        {displayStories.length > 0 && (
          layout === 'grid' ? (
            /* Grid layout — thumbnail above headline (clips view) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayStories.map((story, index) => {
                const thumb = storyThumbnail(story)
                const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
                const confidence = getConfidenceLabel(story)
                const lowerConfidence = isLowerConfidenceStory(story, sourceType)
                return (
                  <FeedStoryLink
                    key={story.id}
                    href={`/story/${story.slug}`}
                    event="feed_clip_click"
                    properties={{
                      section: title,
                      story_slug: story.slug,
                      source_type: sourceType,
                      source_tier: tier,
                      confidence,
                      coverage_count: coverageCount(story),
                      position: index + 1,
                      is_lower_confidence: lowerConfidence,
                    }}
                    className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
                    style={{
                      background: lowerConfidence ? 'rgba(17,24,39,0.72)' : '#111827',
                      border: lowerConfidence ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-white/5 overflow-hidden">
                      {thumb ? (
                        <Image
                          src={thumb} alt={story.title} fill
                          className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-white/20 text-3xl">📰</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#11182766] to-transparent" />
                      {/* Badges over image */}
                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        <CategoryBadge category={story.category} />
                        {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
                      </div>
                      <span className="absolute top-2 right-2 text-[10px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                        {formatPublishedDate(story.created_at)}
                      </span>
                    </div>

                    {/* Text below image */}
                    <div className="flex flex-col flex-1 p-3">
                      <h3 className={`${lowerConfidence ? 'text-[13px] text-white/75' : 'text-sm text-white/90'} font-bold group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-2`}>
                        {story.title}
                      </h3>
                      {story.description && (
                        <p className={`text-xs ${lowerConfidence ? 'text-white/40 line-clamp-1' : 'text-white/50 line-clamp-2'} leading-relaxed mb-2`}>{story.description}</p>
                      )}
                      <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                        <ConfidenceBadge label={confidence} />
                        <span className="text-[10px] text-white/30">{coverageText(story)}</span>
                      </div>
                    </div>
                  </FeedStoryLink>
                )
              })}
            </div>
          ) : (
            /* List layout — text rows (digest view) */
            <div className="flex flex-col gap-1">
              {displayStories.map((story, index) => {
                const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
                const confidence = getConfidenceLabel(story)
                const lowerConfidence = isLowerConfidenceStory(story, sourceType)
                return (
                  <FeedStoryLink
                    key={story.id}
                    href={`/story/${story.slug}`}
                    properties={{
                      section: title,
                      story_slug: story.slug,
                      source_type: sourceType,
                      source_tier: tier,
                      confidence,
                      coverage_count: coverageCount(story),
                      position: index + 1,
                      is_lower_confidence: lowerConfidence,
                    }}
                    className="group flex gap-3 items-start rounded-xl px-3 py-3 transition-all"
                    style={{
                      borderLeft: `3px solid ${lowerConfidence ? '#64748b' : accent}`,
                      background: lowerConfidence ? 'rgba(255,255,255,0.018)' : 'rgba(255,255,255,0.03)',
                      marginBottom: '6px',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <CategoryBadge category={story.category} />
                        {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
                        {story.region && (
                          <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: accent }}>{story.region}</span>
                        )}
                      </div>
                      <h3 className={`${lowerConfidence ? 'text-[13px] text-white/75' : 'text-sm sm:text-[0.95rem] text-white/90'} font-bold leading-snug line-clamp-2 group-hover:underline underline-offset-2 mb-1.5`}>
                        {story.title}
                      </h3>
                      {story.description && (
                        <p className={`text-xs ${lowerConfidence ? 'text-white/40 line-clamp-1' : 'text-white/50 line-clamp-2'} leading-relaxed mb-2`}>{story.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                        <ConfidenceBadge label={confidence} />
                        <span className="text-[10px] text-white/30">{coverageText(story)}</span>
                        <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>
                        {story.journalist_username && (
                          <span className="text-[10px] text-white/30">@{story.journalist_username}</span>
                        )}
                      </div>
                    </div>
                  </FeedStoryLink>
                )
              })}
            </div>
          )
        )}

        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </section>
  )
}
