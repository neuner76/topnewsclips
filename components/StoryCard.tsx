'use client'

import Link from 'next/link'
import Image from 'next/image'
import { track } from '@/lib/analytics'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import CategoryBadge from './CategoryBadge'
import MSMBadge from './MSMBadge'

interface StoryCardProps {
  story: Story
  /** layout='grid' renders image-first card (Ground.news style); 'list' renders compact row */
  layout?: 'grid' | 'list'
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (!m) return null
  return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`
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

function getTierLabel(tier: number): string {
  if (tier <= 3) return 'High credibility'
  if (tier <= 6) return 'Mid credibility'
  return 'Low credibility'
}

function getBarsFilled(tier: number): number {
  return Math.max(1, 11 - tier)
}

/** The trust bar — analogous to Ground.news's L/C/R bias bar */
function TrustBar({ tier, sourceType }: { tier: number | null; sourceType: string | null }) {
  if (!tier || !sourceType) return null
  const color = getTierColor(tier)
  const filled = getBarsFilled(tier)
  const pct = (filled / 10) * 100

  return (
    <div className="mt-auto pt-3">
      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-semibold" style={{ color }}>
          {sourceType}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          T{tier} · {getTierLabel(tier)}
        </span>
      </div>
    </div>
  )
}

export default function StoryCard({ story, layout = 'grid' }: StoryCardProps) {
  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
  const tierColor = tier ? getTierColor(tier) : 'rgba(255,255,255,0.2)'

  if (layout === 'list') {
    // Compact list row — used in digest/detail views
    return (
      <article className="group py-3 border-b border-white/10 last:border-0">
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <CategoryBadge category={story.category} />
              {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
              {story.journalist_username && (
                <span className="text-[10px] font-medium text-white/40">@{story.journalist_username}</span>
              )}
            </div>
            <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
              <h3 className="text-base font-semibold text-white/90 group-hover/title:underline underline-offset-2 line-clamp-2 leading-snug">
                {story.title}
              </h3>
            </Link>
            <TrustBar tier={tier} sourceType={sourceType} />
          </div>
          {thumbnail && (
            <a href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Image
                src={thumbnail} alt={story.title} width={80} height={48}
                className="rounded-lg object-cover w-20 h-12 opacity-80 group-hover:opacity-100 transition-opacity"
                unoptimized
              />
            </a>
          )}
        </div>
      </article>
    )
  }

  // Grid card — image-first, Ground.news style
  return (
    <article
      className="group relative flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{
        background: '#111827',
        border: `1px solid ${tierColor}33`,
        boxShadow: `0 0 0 1px ${tierColor}22`,
      }}
    >
      {/* Image */}
      <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-white/5 overflow-hidden">
        {thumbnail ? (
          <Image
            src={thumbnail} alt={story.title} fill
            className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-3xl">📰</span>
          </div>
        )}
        {/* Gradient overlay so headline reads over image */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#11182766] to-transparent" />

        {/* Badges over image */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <CategoryBadge category={story.category} />
          {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
        </div>

        {/* Time */}
        <span className="absolute top-2 right-2 text-[10px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
          {formatPublishedDate(story.created_at)}
        </span>
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        <Link
          href={`/story/${story.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            track('story_click', { slug: story.slug, platform: story.platform, category: story.category ?? 'unknown' })
          }}
        >
          <h3 className="text-sm font-bold text-white/90 group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-1">
            {story.title}
          </h3>
        </Link>

        {story.description && (
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{story.description}</p>
        )}

        {/* Trust bar — the signature visual, like Ground.news's bias bar */}
        <TrustBar tier={tier} sourceType={sourceType} />
      </div>
    </article>
  )
}
