import Link from 'next/link'
import Image from 'next/image'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { displaySummary } from '@/lib/feed-editorial'
import TierBadge from './TierBadge'
import TrackEvent from './TrackEvent'

interface GlobalBlindspotSectionProps {
  stories: Story[]
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


// Threshold-driven caution: a blindspot story corroborated by at most one
// outlet is a single-source international report — flag it, don't hide it.
function isSingleSourceReport(story: Story): boolean {
  return (story.msm_outlet_coverage?.covered?.length ?? 0) <= 1
}

export default function GlobalBlindspotSection({ stories, layout = 'list' }: GlobalBlindspotSectionProps) {
  if (!stories.length) return null

  return (
    <section className="relative my-10 rounded-2xl overflow-hidden" style={{ background: 'var(--navy-950)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <TrackEvent name="feed_section_impression" properties={{ section: 'Global Blindspot', story_count: stories.length }} />

      {/* CSS globe grid */}
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

      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">

        {/* Header */}
        <div className="mb-6">
          <span className="inline-block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--blindspot-orange)' }}>
            🌍 Global Blindspot
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            What the world is ignoring right now
          </h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(156,163,175,0.9)' }}>
            Important international stories receiving limited attention from major U.S. outlets.
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(156,163,175,0.65)' }}>
            What an outlet leaves out shapes your picture as much as what it covers — these are the gaps worth knowing about.
          </p>
        </div>

        {/* Grid layout — image above headline */}
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.slice(0, 4).map((story) => {
              const thumb = storyThumbnail(story)
              const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
              return (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5"
                  style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="relative aspect-video bg-white/5 overflow-hidden">
                    {thumb ? (
                      <Image src={thumb} alt={story.title} fill className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><span className="text-white/20 text-3xl">📰</span></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#11182766] to-transparent" />
                    {story.region && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.8)', color: 'white' }}>
                        {story.region}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 p-3">
                    <h3 className="text-sm font-bold text-white/90 group-hover:underline underline-offset-2 line-clamp-3 leading-snug mb-2">{story.title}</h3>
                    {story.description && <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-2">{displaySummary(story.description, 55)}</p>}
                    <div className="mt-auto flex items-center gap-2 flex-wrap">
                      <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                      <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>
                      {sourceHandle(story) && (
                        <span className="text-[10px] text-white/30">{sourceHandle(story)}</span>
                      )}
                      <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--blindspot-orange)', border: '1px solid rgba(249,115,22,0.3)' }}>
                        Under-reported
                      </span>
                      {isSingleSourceReport(story) && (
                        <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)' }} title="Only one outlet has covered this so far — treat details as preliminary">
                          Single-source international report
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          /* List layout — no thumbnails */
          <div className="flex flex-col gap-1">
            {stories.slice(0, 4).map((story) => {
              const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
              return (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 items-start rounded-xl p-3 transition-all"
                  style={{ borderLeft: '3px solid var(--blindspot-orange)', background: 'rgba(255,255,255,0.03)', marginBottom: '6px' }}
                >
                  <div className="flex-1 min-w-0">
                    {story.region && (
                      <span className="text-[10px] font-bold tracking-wide uppercase block mb-1" style={{ color: 'var(--blindspot-orange)' }}>{story.region}</span>
                    )}
                    <h3 className="text-base font-bold text-white line-clamp-2 group-hover:underline underline-offset-2 leading-snug mb-1.5">{story.title}</h3>
                    {story.description && (
                      <p className="text-sm text-white/60 line-clamp-3 leading-relaxed mb-2">{displaySummary(story.description, 65)}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <TierBadge tier={tier} sourceType={sourceType} compact asLink={false} />
                      <span className="text-[10px] text-white/30">{formatPublishedDate(story.created_at)}</span>
                      {sourceHandle(story) && (
                        <span className="text-[10px] text-white/30">{sourceHandle(story)}</span>
                      )}
                      <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--blindspot-orange)', border: '1px solid rgba(249,115,22,0.3)' }}>
                        Under-reported
                      </span>
                      {isSingleSourceReport(story) && (
                        <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)' }} title="Only one outlet has covered this so far — treat details as preliminary">
                          Single-source international report
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-5">
          <Link href="/stories?filter=blindspot" className="text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: 'var(--blindspot-orange)' }}>
            See all blindspot stories →
          </Link>
        </div>
      </div>
    </section>
  )
}
