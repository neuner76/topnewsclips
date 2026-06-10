import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'

export const revalidate = 300

const CATEGORY_META: Record<string, { label: string; subtitle: string; description: string; accentClass: string }> = {
  analysis: {
    label: 'Analysis',
    subtitle: 'Independent voices making sense of what\'s happening and why it matters',
    description: 'Independent analysis and commentary on the news stories mainstream media underreports. Deep dives, explainers, and context from voices outside the establishment.',
    accentClass: 'text-[oklch(0.45_0.22_24)]',
  },
  reported: {
    label: 'Reported',
    subtitle: 'Independent journalists investigating what institutions don\'t want you to see',
    description: 'Original reporting and investigations from independent journalists and nonprofit newsrooms covering stories major outlets ignore or underreport.',
    accentClass: 'text-[oklch(0.38_0.13_145)]',
  },
  raw: {
    label: 'Raw Footage',
    subtitle: 'Bodycam, dashcam, security cam, bystander video, unfiltered and unedited',
    description: 'Raw video footage, bodycam, dashcam, security camera, and bystander recordings. Unfiltered primary sources without editorial spin.',
    accentClass: 'text-foreground',
  },
}

const PAGE_SIZE = 50

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const meta = CATEGORY_META[slug]
  if (!meta) return {}

  const title = `${meta.label} | Top News Clips`
  const SITE_URL = 'https://www.topnewsclips.com'

  return {
    title,
    description: meta.description,
    alternates: { canonical: `${SITE_URL}/category/${slug}` },
    openGraph: {
      title,
      description: meta.description,
      url: `${SITE_URL}/category/${slug}`,
    },
    twitter: {
      card: 'summary',
      title,
      description: meta.description,
      site: '@topnewsclips',
    },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams])

  const meta = CATEGORY_META[slug]
  if (!meta) notFound()

  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data, count } = await supabase
    .from('stories')
    .select('*', { count: 'exact' })
    .eq('category', slug)
    .is('region', null)
    .lt('display_order', 99)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const stories = (data as Story[]) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function pageUrl(p: number) {
    return p > 1 ? `/category/${slug}?page=${p}` : `/category/${slug}`
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}
            <Link href="/stories" className="hover:text-foreground transition-colors">Stories</Link>
            {' › '}{meta.label}
          </p>
          <div className="border-l-4 border-[oklch(0.52_0.14_196)] pl-3">
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight uppercase ${meta.accentClass}`}>
              {meta.label}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {count ?? 0} stories
          </p>
        </div>

        {/* Category nav */}
        <div className="flex gap-2 flex-wrap mb-6">
          {Object.entries(CATEGORY_META).map(([s, m]) => (
            <Link
              key={s}
              href={`/category/${s}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${
                s === slug
                  ? 'bg-[oklch(0.52_0.14_196)] text-white border-[oklch(0.52_0.14_196)]'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </div>

        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No stories yet, check back soon.</p>
        ) : (
          <div>
            {stories.map(s => <StoryCard key={s.id} story={s} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            {page > 1 ? (
              <Link href={pageUrl(page - 1)} className="text-sm font-semibold hover:underline underline-offset-2">
                ← Newer
              </Link>
            ) : <span />}
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageUrl(page + 1)} className="text-sm font-semibold hover:underline underline-offset-2">
                Older →
              </Link>
            ) : <span />}
          </div>
        )}

      </main>
      <Footer />
    </>
  )
}
