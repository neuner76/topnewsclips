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

export default function StoryCard({ story, rank }: StoryCardProps) {
  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  return (
    <article className="group py-6 border-t border-border first:border-t-2 first:border-foreground">
      <div className="flex gap-4 sm:gap-6">
        {/* Rank */}
        <div className="hidden sm:block flex-shrink-0 w-8 pt-0.5">
          <span className="text-2xl font-bold text-muted-foreground/30 leading-none tabular-nums">
            {String(rank).padStart(2, '0')}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges + date */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PlatformBadge platform={story.platform} />
            <CategoryBadge category={story.category} />
            {story.subcategory && story.subcategory !== 'footage' && (
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 border border-border px-1.5 py-0.5 rounded">
                {story.subcategory}
              </span>
            )}
            {story.msm_gap && <MSMBadge notes={story.msm_notes} size="sm" />}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatPublishedDate(story.created_at)}
            </span>
          </div>

          {/* Title */}
          <Link href={`/story/${story.slug}`} className="block group/title">
            <h2 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2 decoration-foreground/30">
              {story.title}
            </h2>
          </Link>

          {/* Thumbnail — mobile only, full width below title */}
          {thumbnail && (
            <Link href={`/story/${story.slug}`} className="block sm:hidden mt-2" tabIndex={-1} aria-hidden>
              <Image
                src={thumbnail}
                alt=""
                width={320}
                height={180}
                className="w-full rounded object-cover aspect-video"
                unoptimized
              />
            </Link>
          )}

          {/* Journalist credit */}
          {story.pinned && story.journalist_username && (
            <p className="text-xs text-muted-foreground mt-1">
              @{story.journalist_username}
            </p>
          )}

          {/* Description */}
          {story.description && (
            <p className="editorial-body text-sm mt-2 line-clamp-3 sm:line-clamp-2">{story.description}</p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 mt-3">
            <PressureScore viewCount={story.view_count} shareCount={story.share_count} />
            <Link
              href={`/story/${story.slug}`}
              className="text-xs font-semibold text-foreground hover:underline underline-offset-2 ml-auto"
            >
              Watch →
            </Link>
          </div>
        </div>

        {/* Thumbnail — desktop only, right side */}
        {thumbnail && (
          <Link
            href={`/story/${story.slug}`}
            className="flex-shrink-0 hidden sm:block"
            tabIndex={-1}
            aria-hidden
          >
            <Image
              src={thumbnail}
              alt=""
              width={160}
              height={90}
              className="rounded object-cover w-40 h-[90px] opacity-90 group-hover:opacity-100 transition-opacity"
              unoptimized
            />
          </Link>
        )}
      </div>
    </article>
  )
}
