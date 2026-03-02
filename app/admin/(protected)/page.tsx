import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Link from 'next/link'
import AdminStoryRow from '@/components/admin/AdminStoryRow'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  const { count: subscriberCount } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })

  const allStories = (stories as Story[]) ?? []
  const publishedCount = allStories.filter((s) => s.published).length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Stories', value: allStories.length },
          { label: 'Published', value: publishedCount },
          { label: 'Subscribers', value: subscriberCount ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded border border-border p-4">
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">All Stories</h2>
        <Link
          href="/admin/stories/new"
          className="inline-flex items-center gap-1 bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded hover:opacity-80 transition-opacity"
        >
          + New Story
        </Link>
      </div>

      {/* Story list */}
      {allStories.length === 0 ? (
        <div className="bg-white rounded border border-border py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">No stories yet.</p>
          <Link href="/admin/stories/new" className="text-sm font-semibold underline">
            Add your first story
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded border border-border divide-y divide-border">
          {allStories.map((story) => (
            <AdminStoryRow key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}
