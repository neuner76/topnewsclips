import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import SourceBadge from './SourceBadge'
import CategoryBadge from './CategoryBadge'
import MSMBadge from './MSMBadge'

interface WorldMapSectionProps {
  title: string
  subtitle?: string
  icon: string
  accent: string          // hex color
  mapMode?: 'hero' | 'watermark' | 'blindspot' // kept for API compat, CSS renders now
  stories: Story[]
  seeAllHref?: string
  emptyMessage?: string
  /** Extra content rendered below the story list (e.g. email capture) */
  footer?: React.ReactNode
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

export default function WorldMapSection({
  title, subtitle, icon, accent, mapMode = 'hero',
  stories, seeAllHref, emptyMessage, footer,
}: WorldMapSectionProps) {
  return (
    <section
      className="relative rounded-2xl overflow-hidden mb-8"
      style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}
    >

      {/* Instant CSS globe grid — renders server-side, no JS wait */}
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
      {/* Edge fades */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0d1628bb] via-transparent to-[#0d162888]" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0d1628] via-transparent to-transparent" />

      {/* Colored top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: accent }} />

      {/* Content */}
      <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1.5 block" style={{ color: accent }}>
              {icon} {title}
            </span>
            {subtitle && (
              <p className="text-xs text-white/50 max-w-sm leading-snug">{subtitle}</p>
            )}
          </div>
          {seeAllHref && (
            <Link href={seeAllHref} className="text-xs font-semibold shrink-0 ml-4 transition-opacity hover:opacity-70" style={{ color: accent }}>
              See all →
            </Link>
          )}
        </div>

        {/* Stories */}
        {stories.length === 0 ? (
          <p className="text-sm text-white/30 py-4">{emptyMessage ?? 'Stories being curated — check back soon.'}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {stories.map((story, i) => {
              const thumbnail = storyThumbnail(story)
              const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
              return (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 items-start rounded-xl px-3 py-3 transition-all hover:bg-white/8"
                  style={{
                    borderLeft: `3px solid ${accent}`,
                    background: 'rgba(255,255,255,0.03)',
                    marginBottom: '6px',
                  }}
                >
                  {/* Thumbnail */}
                  {thumbnail && (
                    <div className="shrink-0 hidden sm:block">
                      <Image
                        src={thumbnail} alt={story.title}
                        width={96} height={56}
                        className="rounded-lg object-cover w-24 h-14 opacity-80 group-hover:opacity-100 transition-opacity"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    {/* Category + badges row */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <CategoryBadge category={story.category} />
                      {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
                      {story.region && (
                        <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: accent }}>
                          {story.region}
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <h3 className="text-sm sm:text-[0.95rem] font-bold text-white/90 leading-snug line-clamp-2 group-hover:underline underline-offset-2 mb-1.5">
                      {story.title}
                    </h3>

                    {/* Description */}
                    {story.description && (
                      <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">
                        {story.description}
                      </p>
                    )}

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SourceBadge tier={tier} sourceType={sourceType} compact />
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
        )}

        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </section>
  )
}
