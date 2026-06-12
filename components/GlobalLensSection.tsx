import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import TierBadge from './TierBadge'
import TrackEvent from './TrackEvent'

interface GlobalLensItem {
  slug: string
  title: string
  summary: string
  region: string
}

interface GlobalLensSectionProps {
  items?: GlobalLensItem[]
  stories?: Story[]
  storyMap?: Map<string, Story>
  layout?: 'grid' | 'list'
}

function getYouTubeThumbnail(embedUrl: string): string | null {
  const m = embedUrl?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function storyThumbnail(s: Story): string | null {
  return s.platform === 'youtube' ? getYouTubeThumbnail(s.embed_url) : s.thumbnail_url ?? null
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

function sourceHandle(story: Story): string | null {
  if (story.journalist_username) return `@${story.journalist_username}`
  const source = story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '').trim()
  return source ? `@${source.replace(/\s+/g, '').toLowerCase()}` : null
}

const REGION_FLAGS: Record<string, string> = {
  'Europe': '🇪🇺', 'Asia': '🌏', 'Africa': '🌍', 'Middle East': '🌍',
  'Latin America': '🌎', 'South America': '🌎', 'Australia': '🇦🇺',
  'China': '🇨🇳', 'Russia': '🇷🇺', 'India': '🇮🇳', 'Japan': '🇯🇵',
  'UK': '🇬🇧', 'France': '🇫🇷', 'Germany': '🇩🇪', 'Canada': '🇨🇦',
  'Brazil': '🇧🇷', 'Mexico': '🇲🇽', 'Israel': '🇮🇱', 'Iran': '🇮🇷',
  'Ukraine': '🇺🇦', 'Turkey': '🇹🇷', 'South Korea': '🇰🇷',
}

function regionFlag(region: string): string {
  for (const [key, flag] of Object.entries(REGION_FLAGS)) {
    if (region.toLowerCase().includes(key.toLowerCase())) return flag
  }
  return '🌐'
}

export default function GlobalLensSection({ items, stories, storyMap, layout = 'list' }: GlobalLensSectionProps) {
  const displayItems: Array<{ story: Story | null; region: string; title: string; summary: string; slug: string }> = []

  if (items && storyMap) {
    for (const item of items.slice(0, 5)) {
      const story = storyMap.get(item.slug) ?? null
      displayItems.push({ story, region: item.region, title: item.title, summary: item.summary, slug: item.slug })
    }
  } else if (stories) {
    for (const s of stories.slice(0, 5)) {
      displayItems.push({ story: s, region: s.region ?? 'Global', title: s.title, summary: s.description ?? '', slug: s.slug })
    }
  }

  if (!displayItems.length) return null

  return (
    <section className="relative my-10 rounded-2xl overflow-hidden" style={{ background: '#0d1628', border: '1px solid rgba(255,255,255,0.07)' }}>
      <TrackEvent name="feed_section_impression" properties={{ section: 'Global Lens', story_count: displayItems.length }} />

      {/* CSS globe grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 65% 45%, rgba(59,130,246,0.18) 0%, transparent 60%),
            radial-gradient(ellipse at 25% 75%, rgba(59,130,246,0.07) 0%, transparent 50%),
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px, 12px 12px, 12px 12px',
        }}
      />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1628] via-[#0d1628cc] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1628] via-transparent to-transparent" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[5px] rounded-t-2xl" style={{ background: '#3b82f6' }} />

      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">

        {/* Header */}
        <div className="mb-6">
          <span className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#3b82f6' }}>
            🌐 Global Lens
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            How the world sees it
          </h2>
          <p className="text-sm mt-1 text-white/60">
            How international outlets are framing major stories differently.
          </p>
        </div>

        {/* Grid layout — image above headline */}
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayItems.map(({ story, region, title, summary, slug }) => {
              const thumb = story ? storyThumbnail(story) : null
              const { tier, sourceType } = story
                ? getSourceTier(story.journalist_username, story.source ?? '', story.category)
                : { tier: null, sourceType: null }
              return (
                <Link
                  key={slug}
                  href={`/story/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
                  style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="relative aspect-video bg-white/5 overflow-hidden">
                    {thumb ? (
                      <Image src={thumb} alt={title} fill className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><span className="text-white/20 text-3xl">📰</span></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#11182766] to-transparent" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.8)', color: 'white' }}>
                      {regionFlag(region)} {region}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 p-3">
                    <h3 className="text-sm font-bold text-white/90 group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-2">{title}</h3>
                    {summary && <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{summary}</p>}
                    {tier !== null && (
                      <div className="mt-auto flex items-center gap-2 flex-wrap">
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                        {story && <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>}
                        {story && sourceHandle(story) && (
                          <span className="text-[10px] text-white/30">{sourceHandle(story)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          /* List layout — no thumbnails */
          <div className="flex flex-col gap-1">
            {displayItems.map(({ story, region, title, summary, slug }) => {
              const { tier, sourceType } = story
                ? getSourceTier(story.journalist_username, story.source ?? '', story.category)
                : { tier: null, sourceType: null }
              return (
                <Link
                  key={slug}
                  href={`/story/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 items-start rounded-xl p-3 transition-all"
                  style={{ borderLeft: '3px solid #3b82f6', background: 'rgba(255,255,255,0.03)', marginBottom: '6px' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-sm">{regionFlag(region)}</span>
                      <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: '#3b82f6' }}>{region}</span>
                    </div>
                    <h3 className="text-base font-bold text-white line-clamp-2 group-hover:underline underline-offset-2 leading-snug mb-1.5">{title}</h3>
                    {summary && <p className="text-sm text-white/60 mt-0.5 line-clamp-3 leading-relaxed mb-2">{summary}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {tier !== null && (
                        <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                      )}
                      {story && <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>}
                      {story && sourceHandle(story) && (
                        <span className="text-[10px] text-white/30">{sourceHandle(story)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-5">
          <Link href="/stories?filter=global" className="text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: '#3b82f6' }}>
            See all global coverage →
          </Link>
        </div>
      </div>
    </section>
  )
}
