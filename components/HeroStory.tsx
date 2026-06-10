'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierMeter from './TierMeter'
import CategoryBadge from './CategoryBadge'

const WorldMap = dynamic(() => import('./WorldMap'), { ssr: false })

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
      className="relative rounded-2xl overflow-hidden mb-8"
      style={{ background: 'var(--navy-950)', minHeight: 260 }}
    >
      {/* World map background */}
      <div className="absolute inset-0">
        <WorldMap mode="hero" className="w-full h-full" />
        {/* Gradient darkens bottom and left for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e99] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e] via-transparent to-transparent" />
      </div>

      {/* Thumbnail image on the right — decorative */}
      {thumbnail && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden sm:block">
          <Image
            src={thumbnail}
            alt={story.title}
            fill
            className="object-cover opacity-20"
            unoptimized
          />
          {/* Extra fade from left so image blends into map */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e] to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 max-w-2xl">
        {/* Category */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="text-[10px] font-bold tracking-[0.15em] uppercase"
            style={{ color: 'var(--electric-blue)' }}
          >
            Top Story
          </span>
          <CategoryBadge category={story.category} />
        </div>

        {/* Headline */}
        <Link href={`/story/${story.slug}`} target="_blank" rel="noopener noreferrer">
          <h1 className="editorial-title text-white hover:underline underline-offset-4 decoration-white/30 line-clamp-3 mb-3">
            {story.title}
          </h1>
        </Link>

        {/* Description */}
        {story.description && (
          <p className="text-sm sm:text-base text-white/70 line-clamp-2 mb-4">
            {story.description}
          </p>
        )}

        {/* Credibility meter + CTA */}
        <div className="flex items-center gap-4 flex-wrap">
          <TierMeter tier={tier} sourceType={sourceType} />
          <Link
            href={`/story/${story.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'var(--electric-blue)', color: 'white' }}
          >
            Full story →
          </Link>
        </div>
      </div>
    </div>
  )
}
