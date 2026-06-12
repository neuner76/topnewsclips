'use client'

import Link from 'next/link'
import Image from 'next/image'
import { track } from '@/lib/analytics'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'
import CategoryBadge from './CategoryBadge'
import MSMBadge from './MSMBadge'
import TierBadge from './TierBadge'
import ConfidenceBadge from './ConfidenceBadge'

interface StoryCardProps {
  story: Story
  layout?: 'grid' | 'list'
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (!m) return null
  return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`
}

function coverageText(story: Story): string {
  const covered = story.msm_outlet_coverage?.covered?.length ?? 0
  const total = covered + (story.msm_outlet_coverage?.notCovered?.length ?? 0)
  return total > 0 ? `${covered} of ${total} outlets` : 'Coverage pending'
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

export default function StoryCard({ story, layout = 'grid' }: StoryCardProps) {
  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)

  if (layout === 'list') {
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
            <div className="mt-2">
              <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
            </div>
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

  // Grid card — image above headline
  return (
    <article
      className="group relative flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#11182766] to-transparent" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <CategoryBadge category={story.category} />
          {story.msm_gap && <MSMBadge notes={story.msm_notes} coverage={story.msm_outlet_coverage} size="sm" />}
        </div>
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
          onClick={() => track('story_click', { slug: story.slug, platform: story.platform, category: story.category ?? 'unknown' })}
        >
          <h3 className="text-sm font-bold text-white/90 group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-1">
            {story.title}
          </h3>
        </Link>
        {story.description && (
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{story.description}</p>
        )}
        <div className="mt-auto pt-1 flex flex-wrap items-center gap-2">
          <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
          <ConfidenceBadge label={getConfidenceLabel(story)} />
          <span className="text-[10px] text-white/30">{coverageText(story)}</span>
        </div>
      </div>
    </article>
  )
}
