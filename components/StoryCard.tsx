import Link from 'next/link'
import type { Story } from '@/lib/types'
import MSMBadge from './MSMBadge'
import PlatformBadge from './PlatformBadge'
import PressureScore from './PressureScore'

interface StoryCardProps {
  story: Story
  rank: number
}

export default function StoryCard({ story, rank }: StoryCardProps) {
  return (
    <article className="group py-6 rule-thin border-t border-border first:border-t-2 first:border-foreground">
      <div className="flex gap-4 sm:gap-6">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 pt-0.5">
          <span className="text-2xl font-bold text-muted-foreground/30 leading-none tabular-nums">
            {String(rank).padStart(2, '0')}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PlatformBadge platform={story.platform} />
            {story.msm_gap && <MSMBadge notes={story.msm_notes} size="sm" />}
          </div>

          {/* Title */}
          <Link href={`/story/${story.slug}`} className="block group/title">
            <h2 className="editorial-headline text-foreground group-hover/title:underline underline-offset-2 decoration-foreground/30">
              {story.title}
            </h2>
          </Link>

          {/* Description */}
          {story.description && (
            <p className="editorial-body text-sm mt-1.5 line-clamp-2">{story.description}</p>
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
      </div>
    </article>
  )
}
