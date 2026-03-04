'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import MSMBadge from './MSMBadge'
import PlatformBadge from './PlatformBadge'
import PressureScore from './PressureScore'
import CategoryBadge from './CategoryBadge'

interface StoryCardProps {
  story: Story
  rank: number
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (!m) return null
  return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`
}

function getEmbedUrl(story: Story): string | null {
  if (story.platform === 'youtube') {
    const m = story.embed_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (!m) return null
    return `https://www.youtube.com/embed/${m[1]}?autoplay=1`
  }
  if (story.platform === 'tiktok') {
    const m = story.embed_url.match(/video\/(\d+)/)
    if (!m) return null
    return `https://www.tiktok.com/embed/v2/${m[1]}`
  }
  return null
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
  const [showEmbed, setShowEmbed] = useState(false)

  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  const embedUrl = getEmbedUrl(story)
  const canEmbed = !!embedUrl
  const isTikTok = story.platform === 'tiktok'

  return (
    <article className="group py-3 border-b border-border">
      {/* Thumbnail — full width on mobile, hidden on desktop (shown in row below) */}
      {thumbnail && !showEmbed && (
        <button
          onClick={() => canEmbed && setShowEmbed(true)}
          className="block sm:hidden w-full mb-2 text-left"
          tabIndex={-1}
          aria-hidden
        >
          <Image
            src={thumbnail}
            alt=""
            width={640}
            height={360}
            className="rounded object-cover w-full aspect-video opacity-90 group-hover:opacity-100 transition-opacity"
            unoptimized
          />
        </button>
      )}

      <div className="flex gap-3 items-start">
        {/* Thumbnail — desktop only, left side */}
        {thumbnail && !showEmbed && (
          <button
            onClick={() => canEmbed && setShowEmbed(true)}
            className="flex-shrink-0 hidden sm:block"
            tabIndex={-1}
            aria-hidden
          >
            <Image
              src={thumbnail}
              alt=""
              width={120}
              height={68}
              className="rounded object-cover w-32 h-[72px] opacity-90 group-hover:opacity-100 transition-opacity"
              unoptimized
            />
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <PlatformBadge platform={story.platform} />
            <CategoryBadge category={story.category} />
            {story.msm_gap && <MSMBadge notes={story.msm_notes} size="sm" />}
            {story.journalist_username && (
              <span className="text-[10px] font-medium text-muted-foreground">
                @{story.journalist_username}
              </span>
            )}
          </div>

          {/* Title */}
          <Link href={`/story/${story.slug}`} className="block group/title">
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
            {canEmbed ? (
              <button
                onClick={() => setShowEmbed(v => !v)}
                className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto"
              >
                {showEmbed ? '▲ Close' : 'Watch →'}
              </button>
            ) : (
              <a
                href={story.embed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2 ml-auto"
              >
                Watch ↗
              </a>
            )}
          </div>
        </div>

      </div>

      {/* Inline embed */}
      {showEmbed && embedUrl && (
        <div className={`mt-3 ${isTikTok ? 'flex justify-start' : 'w-full'}`}>
          <iframe
            src={embedUrl}
            className={
              isTikTok
                ? 'rounded border border-border w-full max-w-[325px] h-[580px]'
                : 'w-full rounded border border-border aspect-video'
            }
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </article>
  )
}
