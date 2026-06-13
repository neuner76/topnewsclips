import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import { issueSearchTokens } from '@/lib/issue-trackers'

export const dynamic = 'force-dynamic'

function titleFromSlug(slug: string) {
  return slug.split('-').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; story?: string }>
}) {
  const { slug } = await params
  const { q, story } = await searchParams
  if (!slug) notFound()

  const query = (q?.trim() || slug.replace(/-/g, ' ')).trim()
  const tokens = issueSearchTokens(query)
  const supabase = await createClient()
  let stories: Story[] = []

  if (tokens.length > 0) {
    const searchFilter = tokens.flatMap(token => [`title.ilike.%${token}%`, `description.ilike.%${token}%`]).join(',')
    const { data } = await supabase
      .from('stories')
      .select('*')
      .lt('display_order', 99)
      .or(searchFilter)
      .order('created_at', { ascending: false })
      .limit(20)
    stories = (data as Story[]) ?? []
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-white">
        <nav className="flex items-center gap-1.5 text-xs text-white/45 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>›</span>
          <span>Issue Tracker</span>
        </nav>

        <div className="mb-8 border-b border-white/10 pb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">Track this issue</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">{titleFromSlug(slug)}</h1>
          <p className="text-sm text-white/60 leading-relaxed">
            We&apos;ll surface meaningful updates and related stories here.
          </p>
          {story && (
            <p className="text-xs text-white/45 mt-3">
              Started from <Link href={`/story/${story}`} className="font-semibold text-white/70 hover:text-white hover:underline">this story</Link>.
            </p>
          )}
        </div>

        {stories.length > 0 ? (
          <div>
            <p className="text-sm text-white/55 mb-4">{stories.length} related {stories.length === 1 ? 'story' : 'stories'} for “{query}”.</p>
            {stories.map(s => <StoryCard key={s.id} story={s} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-white mb-1">No related updates yet.</p>
            <p className="text-sm text-white/55">
              This can happen when an issue is new or the archive has only one relevant story. Check back after the next fetch and digest cycle.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
