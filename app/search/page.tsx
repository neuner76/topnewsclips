import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  return {
    title: q ? `"${q}", Search | Top News Clips` : 'Search | Top News Clips',
    description: 'Search independent journalism, bodycam footage, and global stories on Top News Clips.',
    robots: { index: false },
  }
}

const PAGE_SIZE = 30

function searchTokens(query: string): string[] {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 3)
      .slice(0, 5)
  )]
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const query = q?.trim() ?? ''
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let stories: Story[] = []
  let total = 0

  if (query.length >= 2) {
    const supabase = await createClient()
    const tokens = searchTokens(query)
    const searchFilter = tokens.length > 1
      ? tokens.flatMap(token => [`title.ilike.%${token}%`, `description.ilike.%${token}%`]).join(',')
      : `title.ilike.%${query}%,description.ilike.%${query}%`
    const { data, count } = await supabase
      .from('stories')
      .select('*', { count: 'exact' })
      .lt('display_order', 99)
      .or(searchFilter)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    stories = (data as Story[]) ?? []
    total = count ?? 0
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    params.set('q', query)
    if (p > 1) params.set('page', String(p))
    return `/search?${params.toString()}`
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-foreground">

        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}Search
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-foreground">Search</h1>

          <form method="GET" action="/search">
            <div className="flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search stories, topics, journalists..."
                autoFocus
                autoComplete="off"
                className="flex-1 text-base px-4 py-2.5 rounded-lg border border-border bg-white text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#2563EB] text-foreground text-sm font-semibold hover:opacity-80 transition-opacity shrink-0"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {query.length >= 2 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {total === 0
                ? `No results for "${query}"`
                : `${total} result${total !== 1 ? 's' : ''} for "${query}"`}
            </p>

            {stories.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm mb-4">No stories matched your search.</p>
                <p className="text-xs text-muted-foreground">Try different keywords or browse by category:</p>
                <div className="flex justify-center gap-3 mt-3">
                  {(['analysis', 'reported', 'raw'] as const).map(c => (
                    <Link
                      key={c}
                      href={`/category/${c}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors capitalize"
                    >
                      {c === 'raw' ? 'Raw Footage' : c.charAt(0).toUpperCase() + c.slice(1)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {stories.map(s => <StoryCard key={s.id} story={s} />)}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                {page > 1 ? (
                  <Link href={pageUrl(page - 1)} className="text-sm font-semibold text-foreground hover:underline underline-offset-2">
                    ← Previous
                  </Link>
                ) : <span />}
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={pageUrl(page + 1)} className="text-sm font-semibold text-foreground hover:underline underline-offset-2">
                    Next →
                  </Link>
                ) : <span />}
              </div>
            )}
          </>
        ) : query.length > 0 ? (
          <p className="text-sm text-muted-foreground">Enter at least 2 characters to search.</p>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>Search across all stories, topics, and journalists.</p>
          </div>
        )}

      </main>
      <Footer />
    </>
  )
}
