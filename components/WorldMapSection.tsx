import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierBadge from './TierBadge'
import CategoryBadge from './CategoryBadge'
import MSMBadge from './MSMBadge'

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

function getTierColor(tier: number): string {
  if (tier <= 3) return '#22c55e'
  if (tier <= 6) return '#f59e0b'
  return '#ef4444'
}

export default function WorldMapSection({
  title, subtitle, icon, accent, mapMode = 'hero',
  stories, seeAllHref, footer, layout = 'list',
}: WorldMapSectionProps) {
  return (
    <section
      className="relative rounded-2xl overflow-hidden mb-8"
      style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
    >
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
        {stories.length > 0 && (
          layout === 'grid' ? (
            /* Grid layout — thumbnail above headline (clips view) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stories.map((story) => {
                const thumb = storyThumbnail(story)
                const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
                const tierColor = tier ? getTierColor(tier) : 'rgba(255,255,255,0.2)'
                return (
                  <Link
                    key={story.id}
                    href={`/story/${story.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
                    style={{
                      background: '#111827',
                      border: `1px solid ${tierColor}33`,
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
                      <h3 className="text-sm font-bold text-white/90 group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-2">
                        {story.title}
                      </h3>
                      {story.description && (
                        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{story.description}</p>
                      )}
                      {/* Trust bar */}
                      <div className="mt-auto pt-2">
                        <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(10, (11 - (tier ?? 10)) * 10)}%`, background: tierColor }}
                          />
                        </div>
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            /* List layout — text rows (digest view) */
            <div className="flex flex-col gap-1">
              {stories.map((story) => {
                const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
                return (
                  <Link
                    key={story.id}
                    href={`/story/${story.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 items-start rounded-xl px-3 py-3 transition-all"
                    style={{ borderLeft: `3px solid ${accent}`, background: 'rgba(255,255,255,0.03)', marginBottom: '6px' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <CategoryBadge category={story.category} />
                        {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
                        {story.region && (
                          <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: accent }}>{story.region}</span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-[0.95rem] font-bold text-white/90 leading-snug line-clamp-2 group-hover:underline underline-offset-2 mb-1.5">
                        {story.title}
                      </h3>
                      {story.description && (
                        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{story.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                        <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>
                        {story.journalist_username && (
                          <span className="text-[10px] text-white/30">@{story.journalist_username}</span>
                        )}
                      </div>
                    </div>
                  </Link>
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
