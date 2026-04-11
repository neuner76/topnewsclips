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
import PressureScore from '@/components/PressureScore'
import ShareButtons from '@/components/ShareButtons'
import GlobalBlindspotBadge from '@/components/GlobalBlindspotBadge'
import EmailCaptureInline from '@/components/EmailCaptureInline'
import SourceTypeBadge from '@/components/SourceTypeBadge'
import ConfidenceBadge from '@/components/ConfidenceBadge'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'

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
    : `Watch: ${data.title} — independent news and footage on Top News Clips.`
  const canonicalUrl = `https://www.topnewsclips.com/story/${slug}`

  const ytMatch = data.embed_url?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : null

  return {
    title: `${data.title} — Top News Clips`,
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

  // World View — find related stories from other regions covering the same topic
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: relatedPool } = await supabase
    .from('stories')
    .select('id, title, slug, description, region, msm_gap')
    .eq('published', true)
    .gte('created_at', recentCutoff)
    .not('region', 'is', s.region) // opposite track: global stories for US page, US for global page

  function sigWords(title: string): Set<string> {
    const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','that','this','is','are','was','were','be','been','have','has','had','will','after','during','its','as','over','into'])
    return new Set(
      title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
        .filter(w => w.length > 3 && !stop.has(w))
    )
  }

  const storyWords = sigWords(s.title)
  const worldView = (relatedPool ?? [])
    .filter(r => {
      const words = sigWords(r.title)
      let overlap = 0
      for (const w of storyWords) if (words.has(w)) overlap++
      return overlap >= 2
    })
    .filter(r => r.region !== null || s.region !== null) // at least one must be international

  const canonicalUrl = `https://www.topnewsclips.com/story/${s.slug}`
  const ogImage = s.platform === 'youtube' ? getYouTubeThumbnailUrl(s.embed_url) : s.thumbnail_url ?? null

  const fullDescription = (s.description ?? '').trim()
  const shortDescription = fullDescription.slice(0, 155)

  const badge = getSourceTier(s.journalist_username, s.source ?? '', s.category)
  const confidence = getConfidenceLabel(s)
  const coveredCount = s.msm_outlet_coverage?.covered?.length ?? 0
  const totalChecked = (s.msm_outlet_coverage?.covered?.length ?? 0) + (s.msm_outlet_coverage?.notCovered?.length ?? 0)
  const coverageDisplay = totalChecked > 0 ? `${coveredCount} of ${totalChecked} major US outlets` : coveredCount > 0 ? `${coveredCount} outlets` : 'Not yet checked'
  const tierLabel = badge.sourceType ? `${badge.sourceType}${badge.tier ? ` (Tier ${badge.tier})` : ''}` : null
  const contentTypeLabel = s.category === 'raw' ? 'Raw Footage' : s.category === 'analysis' ? 'Analysis' : s.category === 'reported' ? 'Reported' : null
  const publishedLabel = new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
  const updatedLabel = s.updated_at !== s.created_at ? new Date(s.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' }) : null

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
        description: fullDescription || shortDescription,
        articleBody: fullDescription || undefined,
        url: canonicalUrl,
        datePublished: s.created_at,
        dateModified: s.updated_at,
        image: ogImage ?? undefined,
        author: {
          '@type': 'Organization',
          name: 'Top News Clips',
          url: 'https://www.topnewsclips.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Top News Clips',
          url: 'https://www.topnewsclips.com',
        },
        mainEntityOfPage: canonicalUrl,
      },
      ...(s.platform === 'youtube' && s.embed_url ? (() => {
        const m = s.embed_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
        if (!m) return []
        return [{
          '@type': 'VideoObject',
          name: s.title,
          description: fullDescription || shortDescription,
          thumbnailUrl: ogImage ?? undefined,
          uploadDate: s.created_at,
          embedUrl: s.embed_url,
          contentUrl: `https://www.youtube.com/watch?v=${m[1]}`,
          url: canonicalUrl,
          ...(s.duration ? { duration: s.duration } : {}),
        }]
      })() : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>›</span>
          <Link href="/?view=clips" className="hover:text-foreground transition-colors">Clips</Link>
          {s.category && (
            <>
              <span>›</span>
              <span className="capitalize">{s.category}</span>
            </>
          )}
        </nav>

        {/* Archived banner */}
        {!s.published && (
          <div className="mb-5 px-4 py-3 bg-muted border border-border rounded text-sm text-muted-foreground">
            This story is from {new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} and has cycled out of the daily feed.{' '}
            <Link href="/" className="font-semibold text-foreground hover:underline underline-offset-2">
              See today&apos;s stories →
            </Link>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <PlatformBadge platform={s.platform} />
          <CategoryBadge category={s.category} />
          <SourceTypeBadge {...badge} />
          <ConfidenceBadge label={confidence} />
          {s.msm_gap && <MSMBadge notes={s.msm_notes} coverage={s.msm_outlet_coverage} />}
        </div>

        {/* Title */}
        <h1 className="editorial-title mb-3">{s.title}</h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
          <PressureScore viewCount={s.view_count} shareCount={s.share_count} />
          <ShareButtons title={s.title} slug={s.slug} />
        </div>

        {/* Embed */}
        <EmbedPlayer embedUrl={s.embed_url} platform={s.platform} title={s.title} />

        {/* Description */}
        {s.description && (
          <p className="editorial-body mt-6 text-foreground/90">{s.description}</p>
        )}

        {/* Why This Is Here */}
        <details className="mt-6 group" open={false}>
          <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase select-none hover:text-foreground transition-colors">
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
            Why this is here
          </summary>
          <div className="mt-3 p-4 bg-muted/50 border border-border rounded-lg text-[13px]">
            <dl className="space-y-1.5">
              {s.journalist_username && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground w-28 shrink-0">Source</dt>
                  <dd className="text-foreground">@{s.journalist_username}</dd>
                </div>
              )}
              {tierLabel && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground w-28 shrink-0">Source type</dt>
                  <dd className="text-foreground">{tierLabel}</dd>
                </div>
              )}
              {contentTypeLabel && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground w-28 shrink-0">Content type</dt>
                  <dd className="text-foreground">{contentTypeLabel}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="font-semibold text-muted-foreground w-28 shrink-0">Confidence</dt>
                <dd className="text-foreground"><ConfidenceBadge label={confidence} /></dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-muted-foreground w-28 shrink-0">Coverage</dt>
                <dd className="text-foreground">{coverageDisplay}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-muted-foreground w-28 shrink-0">Published</dt>
                <dd className="text-foreground">{publishedLabel}</dd>
              </div>
              {updatedLabel && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground w-28 shrink-0">Updated</dt>
                  <dd className="text-foreground">{updatedLabel} (corrected)</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              Confidence labels explain how settled this information is.{' '}
              <Link href="/taxonomy#confidence" className="font-semibold hover:underline underline-offset-2">
                Learn about our confidence system →
              </Link>
            </p>
          </div>
        </details>

        {/* MSM context */}
        {s.msm_gap && (
          <div className="mt-6 p-4 bg-[oklch(0.96_0.03_24)] border border-[oklch(0.88_0.06_24)] rounded">
            <p className="text-xs font-semibold text-[oklch(0.45_0.22_24)] uppercase tracking-wide mb-2">
              Limited Coverage
            </p>
            {s.msm_outlet_coverage ? (
              <div className="space-y-1.5">
                {s.msm_outlet_coverage.covered.length > 0 && (
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Covered by: </span>
                    {s.msm_outlet_coverage.covered.map(o => OUTLET_LABELS[o] ?? o).join(', ')}
                  </p>
                )}
                {s.msm_outlet_coverage.notCovered.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Not covered by: </span>
                    {s.msm_outlet_coverage.notCovered.map(o => OUTLET_LABELS[o] ?? o).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-foreground">
                Fewer than 3 of the 15 major US news outlets we monitor have covered this story at the time of publication.
              </p>
            )}
          </div>
        )}

        {/* World View */}
        {worldView.length > 0 && (
          <div className="mt-8 p-4 bg-[oklch(0.97_0.02_196)] border border-[oklch(0.88_0.06_196)] rounded-lg">
            <p className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase mb-3">
              🌍 World View — How others are covering this
            </p>
            <div className="space-y-3">
              {worldView.map(r => (
                <div key={r.id} className="border-b border-[oklch(0.88_0.06_196)] last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      {r.region ?? 'US'}
                    </span>
                    {r.msm_gap && r.region && <GlobalBlindspotBadge />}
                  </div>
                  <Link
                    href={`/story/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-foreground hover:underline underline-offset-2 leading-snug block"
                  >
                    {r.title}
                  </Link>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscribe nudge */}
        {s.published && (
          <div className="mt-8 p-4 bg-muted/50 border border-border rounded-lg">
            <p className="text-sm font-semibold text-foreground mb-1">Get stories like this every morning.</p>
            <p className="text-xs text-muted-foreground mb-2">Free daily briefing — 5 minutes, no spin.</p>
            <EmailCaptureInline nudge />
          </div>
        )}

        {/* Back to feed */}
        <div className="mt-10 pt-6 border-t border-border flex items-center justify-between">
          <Link
            href="/?view=clips"
            className="text-sm font-semibold text-foreground hover:underline underline-offset-2"
          >
            ← Today&apos;s clips
          </Link>
          <Link
            href="/stories"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
          >
            Browse all stories →
          </Link>
        </div>

      </main>
      <Footer />
    </>
  )
}
