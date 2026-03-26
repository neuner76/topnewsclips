import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'

export const revalidate = 300

const PAGE_SIZE = 50

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'raw', label: 'Raw' },
  { value: 'reported', label: 'Reported' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'global', label: 'Global' },
] as const

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}): Promise<Metadata> {
  const { category } = await searchParams
  const label = CATEGORIES.find(c => c.value === (category ?? ''))?.label ?? 'All'
  return {
    title: `Stories${label !== 'All' ? ` — ${label}` : ''} — Top News Clips`,
    description: 'Browse all Top News Clips stories — independent news, bodycam footage, and global events mainstream media underreports.',
    alternates: { canonical: `https://www.topnewsclips.com/stories${category ? `?category=${category}` : ''}` },
    openGraph: {
      title: `Stories${label !== 'All' ? ` — ${label}` : ''} — Top News Clips`,
      description: 'Browse all Top News Clips stories — independent news, bodycam footage, and global events mainstream media underreports.',
      url: `https://www.topnewsclips.com/stories${category ? `?category=${category}` : ''}`,
    },
    twitter: {
      card: 'summary' as const,
      title: `Stories${label !== 'All' ? ` — ${label}` : ''} — Top News Clips`,
      description: 'Browse all Top News Clips stories — independent news, bodycam footage, and global events mainstream media underreports.',
      site: '@topnewsclips',
    },
  }
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { category, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
    .from('stories')
    .select('*', { count: 'exact' })
    .lt('display_order', 99)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (category === 'global') {
    query = query.not('region', 'is', null)
  } else if (category) {
    query = query.eq('category', category).is('region', null)
  }

  const { data, count } = await query
  const stories = (data as Story[]) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/stories${qs ? `?${qs}` : ''}`
  }

  function categoryUrl(c: string) {
    const params = new URLSearchParams()
    if (c) params.set('category', c)
    const qs = params.toString()
    return `/stories${qs ? `?${qs}` : ''}`
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}Stories
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">All Stories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} stories — what mainstream media misses, what the world is watching
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map(c => {
            const active = (category ?? '') === c.value
            return (
              <Link
                key={c.value}
                href={categoryUrl(c.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${
                  active
                    ? 'bg-[oklch(0.52_0.14_196)] text-white border-[oklch(0.52_0.14_196)]'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                }`}
              >
                {c.label}
              </Link>
            )
          })}
        </div>

        {/* Stories */}
        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No stories found.</p>
        ) : (
          <div>
            {stories.map(s => <StoryCard key={s.id} story={s} />)}
          </div>
        )}

        {/* Pagination */}
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
