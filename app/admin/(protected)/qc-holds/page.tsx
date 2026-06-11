import { createClient } from '@supabase/supabase-js'
import type { Story } from '@/lib/types'
import HoldReviewForm from './HoldReviewForm'
import RecheckAllButton from './RecheckAllButton'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function QCHoldsPage() {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('stories')
    .select('*')
    .eq('qc_status', 'hold')
    .order('created_at', { ascending: false })
    .limit(100)

  const holds = (data ?? []) as Story[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">QC Hold Queue</h1>
        <span className="text-xs text-muted-foreground">{holds.length} held</span>
      </div>

      {holds.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing on hold. The QC firewall hasn&apos;t flagged anything for human review.</p>
      )}

      <div className="space-y-4">
        {holds.map(story => (
          <div key={story.id} className="bg-card border border-border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {story.source ?? 'Unknown source'} · {formatDate(story.created_at)} · {story.category ?? 'uncategorized'}
              </span>
              <a
                href={story.embed_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View source →
              </a>
            </div>

            <h2 className="text-sm font-bold mb-1">{story.title}</h2>
            <p className="text-xs text-muted-foreground mb-3">{story.description}</p>

            {story.qc_routing_note && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">Routing note: {story.qc_routing_note}</p>
            )}

            {story.qc_failed_checks && story.qc_failed_checks.length > 0 && (
              <ul className="text-xs space-y-1 mb-3">
                {story.qc_failed_checks.map(check => (
                  <li key={check.id} className="text-red-700 dark:text-red-400">
                    <span className="font-bold">{check.id}</span> — {check.reason}
                  </li>
                ))}
              </ul>
            )}

            <HoldReviewForm storyId={story.id} initialTitle={story.title} initialDescription={story.description} />
          </div>
        ))}
      </div>
    </div>
  )
}
