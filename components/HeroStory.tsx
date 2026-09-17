import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierBadge from './TierBadge'
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
      className="relative rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)] mb-6"
      style={{ background: '#ffffff', minHeight: 340 }}
    >
      {/* CSS globe grid background, renders instantly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.04) 0%, transparent 65%),
            linear-gradient(rgba(37,99,235,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.02) 1px, transparent 1px),
            linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)
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
            className="object-cover opacity-75"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#ffffff] via-[#ffffff33] to-transparent" />
        </div>
      )}

      {/* Bottom fade for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#ffffff66] via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12 max-w-lg">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-4">
          <CategoryBadge category={story.category} />
        </div>

        {/* Headline */}
        <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer">
          <h1 className="editorial-title text-foreground hover:underline underline-offset-4 decoration-foreground/30 line-clamp-3 mb-4 leading-tight">
            {story.title}
          </h1>
        </Link>

        {/* Description */}
        {story.description && (
          <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 mb-6 leading-relaxed">
            {story.description}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-4 flex-wrap">
          <TierBadge tier={tier} sourceType={sourceType} />
          <Link
            href={`/story/${story.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: '#2563EB', color: 'white' }}
          >
            Full story →
          </Link>
        </div>
      </div>
    </div>
  )
}
