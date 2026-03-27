'use client'

import Link from 'next/link'
import Image from 'next/image'
import { track } from '@/lib/analytics'
import type { Story } from '@/lib/types'
import MSMBadge from './MSMBadge'
import PlatformBadge from './PlatformBadge'
import PressureScore from './PressureScore'
import CategoryBadge from './CategoryBadge'
import SourceTypeBadge from './SourceTypeBadge'

interface StoryCardProps {
  story: Story
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
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

export default function StoryCard({ story }: StoryCardProps) {
  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  return (
    <article className="group py-3 border-b border-border">
      <div className="flex gap-3 items-start">

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <PlatformBadge platform={story.platform} />
            <CategoryBadge category={story.category} />
            {story.msm_gap && <MSMBadge notes={story.msm_notes} size="sm" />}
            <SourceTypeBadge tier={story.source_tier} sourceType={story.source_type} />
            {story.journalist_username && (
              <span className="text-[10px] font-medium text-muted-foreground">
                @{story.journalist_username}
              </span>
            )}
          </div>

          {/* Title */}
          <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer" className="block group/title">
            <h2 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2 decoration-foreground/30 line-clamp-2">
              {story.title}
            </h2>
          </Link>

          {/* Description */}
          {story.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{story.description}</p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2">
            <PressureScore viewCount={story.view_count} shareCount={story.share_count} />
            <span className="text-xs text-muted-foreground">
              {formatPublishedDate(story.created_at)}
            </span>
            <a
              href={`/story/${story.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto"
              onClick={() => track('story_watched', { slug: story.slug, platform: story.platform, category: story.category ?? 'unknown' })}
            >
              Watch →
            </a>
          </div>
        </div>

        {/* Thumbnail — right side, always visible */}
        {thumbnail && (
          <a href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <Image
              src={thumbnail}
              alt={story.title}
              width={96}
              height={56}
              className="rounded object-cover w-24 h-14 opacity-90 group-hover:opacity-100 transition-opacity"
              unoptimized
            />
          </a>
        )}

      </div>
    </article>
  )
}
