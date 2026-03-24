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

  return {
    title: `${data.title} — Top News Clips`,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      ...(ogImage && { images: [{ url: ogImage, width: 1280, height: 720 }] }),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: data.title,
      description: data.description,
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

  return (
    <>
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
