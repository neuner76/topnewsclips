import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import EmailCapture from '@/components/EmailCapture'

export const revalidate = 300 // revalidate every 5 minutes

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('display_order', { ascending: true })
    .order('view_count', { ascending: false })
    .limit(20)

  const publishedStories = (stories as Story[]) ?? []
  const msmBlackoutCount = publishedStories.filter((s) => s.msm_gap).length

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Masthead */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
            {formatDate(new Date())}
          </p>
          <div className="border-t-2 border-foreground pb-4">
            <h1 className="editorial-title pt-4">
              Today&apos;s Top Clips
            </h1>
            <p className="editorial-body mt-2 max-w-2xl">
              The stories social media can&apos;t stop sharing — ranked by real cross-platform
              engagement. Stories marked{' '}
              <span className="font-semibold text-[oklch(0.45_0.22_24)]">MSM BLACKOUT</span>{' '}
              have not appeared in any major mainstream outlet.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {publishedStories.length > 0 && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground mb-6 pb-4 border-b border-border">
            <span>
              <strong className="text-foreground tabular-nums">{publishedStories.length}</strong>{' '}
              stories today
            </span>
            {msmBlackoutCount > 0 && (
              <span>
                <strong className="text-[oklch(0.45_0.22_24)] tabular-nums">{msmBlackoutCount}</strong>{' '}
                MSM blackouts
              </span>
            )}
          </div>
        )}

        {/* Story list */}
        {publishedStories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">Stories are being curated. Check back soon.</p>
          </div>
        ) : (
          <div>
            {publishedStories.map((story, i) => (
              <StoryCard key={story.id} story={story} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Email capture */}
        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
