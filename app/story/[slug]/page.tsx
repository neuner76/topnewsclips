const OUTLET_LABELS: Record<string, string> = {
  'nytimes.com': 'NYT',
  'washingtonpost.com': 'WaPo',
  'cnn.com': 'CNN',
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'nbcnews.com': 'NBC',
  'abcnews.go.com': 'ABC',
  'cbsnews.com': 'CBS',
  'foxnews.com': 'Fox',
  'apnews.com': 'AP',
  'reuters.com': 'Reuters',
  'politico.com': 'Politico',
  'thehill.com': 'The Hill',
  'usatoday.com': 'USA Today',
  'wsj.com': 'WSJ',
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmbedPlayer from '@/components/EmbedPlayer'
import MSMBadge from '@/components/MSMBadge'
import PlatformBadge from '@/components/PlatformBadge'
import CategoryBadge from '@/components/CategoryBadge'
import ShareButtons from '@/components/ShareButtons'
import GlobalBlindspotBadge from '@/components/GlobalBlindspotBadge'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import ConfidenceBadge from '@/components/ConfidenceBadge'
import TierBadge from '@/components/TierBadge'
import SectionCard from '@/components/SectionCard'
import StayWithThisStory from '@/components/StayWithThisStory'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'
import { getResponseEligibility } from '@/lib/response-eligibility'
import { getApprovedResponseResources } from '@/lib/response-resources'
import Image from 'next/image'

export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

function getYouTubeThumbnailUrl(embedUrl: string): string | null {
  const m = embedUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (!m) return null
  return `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('stories')
    .select('title, description, embed_url, platform, published')
    .eq('slug', slug)
    .single()

  if (!data) return {}

  const rawDescription = (data.description ?? '').trim()
  const description = rawDescription.length > 20
    ? rawDescription.slice(0, 155)
    : `Watch: ${data.title}, independent news and footage on Top News Clips.`
  const canonicalUrl = `https://www.topnewsclips.com/story/${slug}`

  const ytMatch = data.embed_url?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : null

  return {
    title: `${data.title} | Top News Clips`,
    description,
    robots: data.published ? undefined : { index: false, follow: false },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: data.title,
      description,
      url: canonicalUrl,
      type: 'article',
      images: thumb ? [{ url: thumb }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description,
      site: '@topnewsclips',
    },
  }
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: story } = await supabase
    .from('stories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!story) notFound()

  const s = story as Story

  // World View, related stories for international pages
  type RelatedStory = { id: string; title: string; slug: string; description: string | null; region: string | null; msm_gap: boolean }
  let worldView: RelatedStory[] = []

  if (s.region) {
    const now = new Date()
    const recentCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const { data: relatedPool } = await supabase
      .from('stories')
      .select('id, title, slug, description, region, msm_gap')
      .eq('published', true)
      .gte('created_at', recentCutoff)
      .is('region', null)

    function sigWords(title: string): Set<string> {
      const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','that','this','is','are','was','were','be','been','have','has','had','will','after','during','its','as','over','into'])
      return new Set(
        title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
          .filter(w => w.length > 4 && !stop.has(w))
      )
    }

    const storyWords = sigWords(s.title)
    worldView = (relatedPool ?? [])
      .filter(r => {
        const words = sigWords(r.title)
        let overlap = 0
        for (const w of storyWords) if (words.has(w)) overlap++
        return overlap >= 3
      })
      .slice(0, 3)
  }

  const canonicalUrl = `https://www.topnewsclips.com/story/${s.slug}`
  const thumbnail = s.platform === 'youtube' ? getYouTubeThumbnailUrl(s.embed_url) : s.thumbnail_url ?? null

  const badge = getSourceTier(s.journalist_username, s.source ?? '', s.category)
  const confidence = getConfidenceLabel(s)
  const coveredCount = s.msm_outlet_coverage?.covered?.length ?? 0
  const totalChecked = (s.msm_outlet_coverage?.covered?.length ?? 0) + (s.msm_outlet_coverage?.notCovered?.length ?? 0)
  const coverageDisplay = totalChecked > 0 ? `${coveredCount} of ${totalChecked} major US outlets` : coveredCount > 0 ? `${coveredCount} outlets` : 'Not yet checked'
  const contentTypeLabel = s.category === 'raw' ? 'Raw Footage' : s.category === 'analysis' ? 'Analysis' : s.category === 'reported' ? 'Reported' : null
  const publishedLabel = new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
  const updatedLabel = s.updated_at !== s.created_at ? new Date(s.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' }) : null
  const responseEligibility = getResponseEligibility(s)
  const responseResources = responseEligibility.eligibility === 'none'
    ? []
    : await getApprovedResponseResources({
      responseTypes: responseEligibility.allowedTypes,
      storyCategory: responseEligibility.storyCategory,
      region: s.region ?? undefined,
      limit: 3,
    })

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.topnewsclips.com' },
      { '@type': 'ListItem', position: 2, name: 'Clips', item: 'https://www.topnewsclips.com/?view=clips' },
      ...(s.category ? [{ '@type': 'ListItem', position: 3, name: s.category.charAt(0).toUpperCase() + s.category.slice(1), item: canonicalUrl }] : []),
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: s.title,
        description: (s.description ?? '').trim(),
        url: canonicalUrl,
        datePublished: s.created_at,
        dateModified: s.updated_at,
        image: thumbnail ?? undefined,
        author: { '@type': 'Organization', name: 'Top News Clips', url: 'https://www.topnewsclips.com' },
        publisher: { '@type': 'Organization', name: 'Top News Clips', url: 'https://www.topnewsclips.com' },
        mainEntityOfPage: canonicalUrl,
      },
      ...(s.platform === 'youtube' && s.embed_url ? (() => {
        const m = s.embed_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
        if (!m) return []
        return [{ '@type': 'VideoObject', name: s.title, description: (s.description ?? '').trim(), thumbnailUrl: thumbnail ?? undefined, uploadDate: s.created_at, embedUrl: s.embed_url, contentUrl: `https://www.youtube.com/watch?v=${m[1]}`, url: canonicalUrl, ...(s.duration ? { duration: s.duration } : {}) }]
      })() : []),
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>›</span>
          <Link href="/?view=clips" className="hover:text-white/70 transition-colors">Clips</Link>
          {s.category && (
            <>
              <span>›</span>
              <span className="capitalize text-white/60">{s.category}</span>
            </>
          )}
        </nav>

        {/* Hero card */}
        <div
          className="relative rounded-2xl overflow-hidden mb-6"
          style={{ background: '#0a0f1e', minHeight: 300 }}
        >
          {/* CSS globe grid */}
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

          {/* Thumbnail right half */}
          {thumbnail && (
            <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden sm:block">
              <Image src={thumbnail} alt={s.title} fill className="object-cover opacity-35" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e] via-[#0a0f1e55] to-transparent" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-transparent to-transparent pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 max-w-xl">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <PlatformBadge platform={s.platform} />
              <CategoryBadge category={s.category} />
              {s.msm_gap && <MSMBadge notes={s.msm_notes} coverage={s.msm_outlet_coverage} />}
            </div>

            {/* Archived banner */}
            {!s.published && (
              <div className="mb-4 px-3 py-2 rounded-lg text-xs text-white/60" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Archived story, cycled out of the daily feed.{' '}
                <Link href="/" className="font-semibold text-white hover:underline underline-offset-2">See today&apos;s stories →</Link>
              </div>
            )}

            {/* Title */}
            <h1 className="editorial-title text-white mb-3 leading-tight">{s.title}</h1>

            {/* Description */}
            {s.description && (
              <p className="text-sm text-white/60 line-clamp-3 mb-5 leading-relaxed">{s.description}</p>
            )}

            {/* Tier meter + share */}
            <div className="flex items-center gap-4 flex-wrap">
              <TierBadge tier={badge.tier} sourceType={badge.sourceType} />
              <div className="ml-auto">
                <ShareButtons title={s.title} slug={s.slug} />
              </div>
            </div>
          </div>
        </div>

        {/* Source Video */}
        <SectionCard accent="#3b82f6" className="mb-4">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#3b82f6] mb-3">📹 Source Video</p>
          <EmbedPlayer embedUrl={s.embed_url} platform={s.platform} title={s.title} />
        </SectionCard>

        {/* Verified vs Interpretation */}
        {s.verified_interpretation && (s.verified_interpretation.verified.length > 0 || s.verified_interpretation.interpretation.length > 0) && (
          <SectionCard accent="#22c55e" className="mb-4">
            {s.verified_interpretation.headerNote && (
              <p className="text-xs text-[#f59e0b] mb-3">{s.verified_interpretation.headerNote}</p>
            )}
            {s.verified_interpretation.verified.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold tracking-widest text-[#22c55e] uppercase mb-2">✓ Verified</p>
                <ul className="space-y-1.5">
                  {s.verified_interpretation.verified.map((claim, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/80">
                      <span className="text-[#22c55e] shrink-0">✓</span>
                      <span>{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.verified_interpretation.interpretation.length > 0 && (
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#3b82f6] uppercase mb-2">~ Interpretation</p>
                <ul className="space-y-1.5">
                  {s.verified_interpretation.interpretation.map((claim, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/60">
                      <span className="text-[#3b82f6] shrink-0">~</span>
                      <span>{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        )}

        {/* Limited Coverage */}
        {s.msm_gap && (
          <SectionCard accent="#ef4444" className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#ef4444] mb-3">⚠️ Limited Coverage</p>
            {s.msm_outlet_coverage ? (
              <div className="space-y-2">
                {s.msm_outlet_coverage.covered.length > 0 && (
                  <p className="text-sm text-white/80">
                    <span className="font-semibold text-white">Covered by: </span>
                    {s.msm_outlet_coverage.covered.map(o => OUTLET_LABELS[o] ?? o).join(', ')}
                  </p>
                )}
                {s.msm_outlet_coverage.notCovered.length > 0 && (
                  <p className="text-sm text-white/50">
                    <span className="font-semibold text-white/70">Not covered by: </span>
                    {s.msm_outlet_coverage.notCovered.map(o => OUTLET_LABELS[o] ?? o).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/70">Fewer than 3 of the 15 major US outlets we monitor have covered this story.</p>
            )}
          </SectionCard>
        )}

        {/* World View */}
        {worldView.length > 0 && (
          <SectionCard accent="#f97316" className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#f97316] mb-4">🌍 World View, How others are covering this</p>
            <div className="space-y-3">
              {worldView.map(r => (
                <div key={r.id} className="border-b border-white/10 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">{r.region ?? 'US'}</span>
                    {r.msm_gap && r.region && <GlobalBlindspotBadge />}
                  </div>
                  <Link href={`/story/${r.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-white/90 hover:underline underline-offset-2 leading-snug block">
                    {r.title}
                  </Link>
                  {r.description && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{r.description}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Why This Is Here */}
        <SectionCard accent="#94a3b8" className="mb-4">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase select-none hover:text-white/80 transition-colors">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
              Why this is here
            </summary>
            <div className="mt-4 space-y-2 text-sm">
              {s.journalist_username && (
                <div className="flex gap-3">
                  <span className="font-semibold text-white/40 w-28 shrink-0">Source</span>
                  <span className="text-white/80">@{s.journalist_username}</span>
                </div>
              )}
              {badge.sourceType && (
                <div className="flex gap-3">
                  <span className="font-semibold text-white/40 w-28 shrink-0">Source type</span>
                  <TierBadge tier={badge.tier} sourceType={badge.sourceType} />
                </div>
              )}
              {contentTypeLabel && (
                <div className="flex gap-3">
                  <span className="font-semibold text-white/40 w-28 shrink-0">Content type</span>
                  <span className="text-white/80">{contentTypeLabel}</span>
                </div>
              )}
              <div className="flex gap-3">
                <span className="font-semibold text-white/40 w-28 shrink-0">Confidence</span>
                <ConfidenceBadge label={confidence} />
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-white/40 w-28 shrink-0">Coverage</span>
                <span className="text-white/80">{coverageDisplay}</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-white/40 w-28 shrink-0">Published</span>
                <span className="text-white/60">{publishedLabel}</span>
              </div>
              {updatedLabel && (
                <div className="flex gap-3">
                  <span className="font-semibold text-white/40 w-28 shrink-0">Updated</span>
                  <span className="text-white/60">{updatedLabel}</span>
                </div>
              )}
              <p className="mt-3 pt-3 border-t border-white/10 text-xs text-white/30">
                <Link href="/taxonomy#confidence" className="font-semibold text-white/50 hover:text-white transition-colors">
                  Learn about our confidence system →
                </Link>
                {' · '}
                <Link href="/how-it-works#selection" className="font-semibold text-white/50 hover:text-white transition-colors">
                  What qualifies a story →
                </Link>
              </p>
            </div>
          </details>
        </SectionCard>

        <StayWithThisStory story={s} resources={responseResources} />

        {/* Subscribe nudge */}
        {s.published && (
          <SectionCard accent="#14b8a6" className="mb-4">
            <p className="text-sm font-semibold text-white mb-1">Get stories like this every morning.</p>
            <p className="text-xs text-white/50 mb-3">Free daily briefing, 5 minutes, no spin.</p>
            <EmailCaptureInline placement="story" />
          </SectionCard>
        )}

        {/* Back nav */}
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
          <Link href="/?view=clips" className="text-sm font-semibold text-white/50 hover:text-white transition-colors">
            ← Today&apos;s clips
          </Link>
          <Link href="/stories" className="text-sm font-semibold text-white/40 hover:text-white transition-colors">
            Browse all stories →
          </Link>
        </div>

      </main>
      <Footer />
    </>
  )
}
