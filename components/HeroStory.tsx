import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierMeter from './TierMeter'
import CategoryBadge from './CategoryBadge'

interface HeroStoryProps {
  story: Story
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

export default function HeroStory({ story }: HeroStoryProps) {
  const thumbnail =
    story.platform === 'youtube'
      ? getYouTubeThumbnail(story.embed_url)
      : story.thumbnail_url ?? null

  const { tier, sourceType } = getSourceTier(
    story.journalist_username,
    story.source ?? '',
    story.category,
  )

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-6"
      style={{ background: '#0a0f1e', minHeight: 340 }}
    >
      {/* CSS globe grid background, renders instantly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 70% 50%, rgba(59,130,246,0.12) 0%, transparent 65%),
            linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px),
            linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />

      {/* Thumbnail, right half, fades left into the grid */}
      {thumbnail && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden sm:block">
          <Image
            src={thumbnail}
            alt={story.title}
            fill
            className="object-cover opacity-40"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e] via-[#0a0f1e55] to-transparent" />
        </div>
      )}

      {/* Bottom fade for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12 max-w-xl">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#3b82f6]">
            Top Story
          </span>
          <CategoryBadge category={story.category} />
        </div>

        {/* Headline */}
        <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer">
          <h1 className="editorial-title text-white hover:underline underline-offset-4 decoration-white/30 line-clamp-3 mb-4 leading-tight">
            {story.title}
          </h1>
        </Link>

        {/* Description */}
        {story.description && (
          <p className="text-sm sm:text-base text-white/60 line-clamp-2 mb-6 leading-relaxed">
            {story.description}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-4 flex-wrap">
          <TierMeter tier={tier} sourceType={sourceType} />
          <Link
            href={`/story/${story.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: '#3b82f6', color: 'white' }}
          >
            Full story →
          </Link>
        </div>
      </div>
    </div>
  )
}
