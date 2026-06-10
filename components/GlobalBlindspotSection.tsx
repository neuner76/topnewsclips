import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import SourceBadge from './SourceBadge'

interface GlobalBlindspotSectionProps {
  stories: Story[]
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function storyThumbnail(s: Story): string | null {
  return s.platform === 'youtube' ? getYouTubeThumbnail(s.embed_url) : s.thumbnail_url ?? null
}

export default function GlobalBlindspotSection({ stories }: GlobalBlindspotSectionProps) {
  if (!stories.length) return null

  return (
    <section className="relative my-10 rounded-2xl overflow-hidden" style={{ background: 'var(--navy-950)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* CSS globe grid — orange-tinted, instant */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 65% 45%, rgba(249,115,22,0.15) 0%, transparent 60%),
            radial-gradient(ellipse at 25% 75%, rgba(249,115,22,0.06) 0%, transparent 50%),
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0a0f1e] via-[#0a0f1ecc] to-transparent" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0f1e] via-transparent to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#f97316' }} />

      {/* Content */}
      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">

        {/* Header */}
        <div className="mb-6">
          <span
            className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
            style={{ color: 'var(--blindspot-orange)' }}
          >
            🌍 Global Blindspot
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            What the world is ignoring right now
          </h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(156,163,175,0.9)' }}>
            Stories covered by less than 5% of Western outlets
          </p>
        </div>

        {/* Story cards */}
        <div className="flex flex-col gap-3">
          {stories.slice(0, 4).map((story) => {
            const thumbnail = storyThumbnail(story)
            const { tier, sourceType } = getSourceTier(
              story.journalist_username,
              story.source ?? '',
              story.category,
            )
            return (
              <Link
                key={story.id}
                href={`/story/${story.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 items-start rounded-xl p-3 transition-all"
                style={{ borderLeft: '3px solid var(--blindspot-orange)', background: 'rgba(255,255,255,0.03)', marginBottom: '6px' }}
              >
                {/* Thumbnail */}
                {thumbnail && (
                  <div className="shrink-0">
                    <Image
                      src={thumbnail}
                      alt={story.title}
                      width={80}
                      height={48}
                      className="rounded object-cover w-20 h-12 opacity-80 group-hover:opacity-100 transition-opacity"
                      unoptimized
                    />
                  </div>
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:underline underline-offset-2">
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {story.region && (
                      <span className="text-[10px] font-medium" style={{ color: 'var(--blindspot-orange)' }}>
                        {story.region}
                      </span>
                    )}
                    <SourceBadge tier={tier} sourceType={sourceType} compact />
                    {/* Western coverage callout badge */}
                    <span
                      className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded"
                      style={{
                        background: 'rgba(249,115,22,0.15)',
                        color: 'var(--blindspot-orange)',
                        border: '1px solid rgba(249,115,22,0.3)',
                      }}
                    >
                      Under-reported
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-5">
          <Link
            href="/stories?filter=blindspot"
            className="text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--blindspot-orange)' }}
          >
            See all blindspot stories →
          </Link>
        </div>
      </div>
    </section>
  )
}
