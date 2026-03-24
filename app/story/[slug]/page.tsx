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
    .select('title, description, embed_url, platform')
    .eq('slug', slug)
    .single()

  if (!data) return {}

  const ogImage = data.platform === 'youtube' ? getYouTubeThumbnailUrl(data.embed_url) : null
  const description = (data.description ?? '').slice(0, 155)
  const canonicalUrl = `https://www.topnewsclips.com/story/${slug}`

  return {
    title: `${data.title} — Top News Clips`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: data.title,
      description,
      url: canonicalUrl,
      ...(ogImage && { images: [{ url: ogImage, width: 1280, height: 720 }] }),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: data.title,
      description,
      site: '@topnewsclips',
      ...(ogImage && { images: [ogImage] }),
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
    .eq('published', true)
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: s.title,
        description: (s.description ?? '').slice(0, 155),
        url: canonicalUrl,
        datePublished: s.created_at,
        dateModified: s.updated_at,
        image: ogImage ?? undefined,
        publisher: {
          '@type': 'Organization',
          name: 'Top News Clips',
          url: 'https://www.topnewsclips.com',
        },
        mainEntityOfPage: canonicalUrl,
      },
      ...(s.platform === 'youtube' && s.embed_url ? [{
        '@type': 'VideoObject',
        name: s.title,
        description: (s.description ?? '').slice(0, 155),
        thumbnailUrl: ogImage ?? undefined,
        uploadDate: s.created_at,
        embedUrl: s.embed_url,
        url: canonicalUrl,
      }] : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          ← Back to Today&apos;s Digest
        </Link>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <PlatformBadge platform={s.platform} />
          <CategoryBadge category={s.category} />
          {s.msm_gap && <MSMBadge notes={s.msm_notes} />}
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
          <p className="editorial-body mt-6">{s.description}</p>
        )}

        {/* MSM context */}
        {s.msm_gap && (
          <div className="mt-6 p-4 bg-[oklch(0.96_0.03_24)] border border-[oklch(0.88_0.06_24)] rounded">
            <p className="text-xs font-semibold text-[oklch(0.45_0.22_24)] uppercase tracking-wide mb-1">
              MSM Blackout
            </p>
            <p className="text-sm text-foreground">
              This story has received little to no coverage from major mainstream outlets, despite significant social media engagement.
            </p>
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

        {/* Back to feed */}
        <div className="mt-10 pt-6 border-t border-border">
          <Link
            href="/?view=clips"
            className="text-sm font-semibold text-foreground hover:underline underline-offset-2"
          >
            ← See all of today&apos;s clips
          </Link>
        </div>

      </main>
      <Footer />
    </>
  )
}
