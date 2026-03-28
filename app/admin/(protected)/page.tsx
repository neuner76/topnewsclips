import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Link from 'next/link'
import AdminStoryRow from '@/components/admin/AdminStoryRow'
import IngestButton from '@/components/admin/IngestButton'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [{ data: stories }, { count: subscriberCount }] = await Promise.all([
    supabase
      .from('stories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('subscribers').select('*', { count: 'exact', head: true }),
  ])

  const allStories = (stories as Story[]) ?? []
  const publishedCount = allStories.filter((s) => s.published).length
  const reviewQueue = allStories.filter((s) => s.published && s.display_order === 75)
  const mainStories = allStories.filter((s) => s.display_order !== 75)

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Stories', value: allStories.length, highlight: false },
          { label: 'Published', value: publishedCount, highlight: false },
          { label: 'Review Queue', value: reviewQueue.length, highlight: reviewQueue.length > 0 },
          { label: 'Subscribers', value: subscriberCount ?? 0, highlight: false },
        ].map((stat) => (
          <div key={stat.label} className={`bg-white rounded border p-4 ${stat.highlight ? 'border-amber-400 bg-amber-50' : 'border-border'}`}>
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Review Queue */}
      {reviewQueue.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-700">
              ⚠ Review Queue — {reviewQueue.length} {reviewQueue.length === 1 ? 'story needs' : 'stories need'} review
            </h2>
            <p className="text-xs text-muted-foreground">Promote to feature · Reject to remove</p>
          </div>
          <div className="bg-white rounded border border-amber-300 divide-y divide-border">
            {reviewQueue.map((story) => (
              <AdminStoryRow key={story.id} story={story} isReview />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">All Stories</h2>
        <div className="flex items-center gap-2">
          <IngestButton />
          <Link
            href="/admin/stories/new"
            className="inline-flex items-center gap-1 bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded hover:opacity-80 transition-opacity"
          >
            + New Story
          </Link>
        </div>
      </div>

      {/* Story list */}
      {mainStories.length === 0 ? (
        <div className="bg-white rounded border border-border py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">No stories yet.</p>
          <Link href="/admin/stories/new" className="text-sm font-semibold underline">
            Add your first story
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded border border-border divide-y divide-border">
          {mainStories.map((story) => (
            <AdminStoryRow key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}
