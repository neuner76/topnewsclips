import { createClient } from '@supabase/supabase-js'
import IngestButton from '@/components/admin/IngestButton'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = 'force-dynamic'

function Badge({ label, color }: { label: string; color: 'green' | 'amber' | 'red' | 'gray' }) {
  const cls = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    red:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    gray:  'bg-muted text-muted-foreground',
  }[color]
  return <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>{label}</span>
}

export default async function PipelinePage() {
  const supabase = getSupabase()
  const now = new Date()
  const todayCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  // Candidates may have been fetched slightly before the 24h window, use 36h to catch today's run
  const candidateCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()

  const [
    { data: candidates },
    { data: rejected },
    { data: publishedToday },
  ] = await Promise.all([
    supabase
      .from('candidates')
      .select('slug, title, platform, source, journalist_username, viral_score, processed, fetched_at, region')
      .gte('fetched_at', candidateCutoff)
      .order('fetched_at', { ascending: false })
      .limit(200),
    supabase
      .from('rejected_slugs')
      .select('slug, reason, created_at')
      .gte('created_at', candidateCutoff)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('stories')
      .select('slug, title, source, journalist_username, display_order, created_at, qc_status')
      .gte('created_at', todayCutoff)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const rejectedSlugs = new Map((rejected ?? []).map(r => [r.slug, r.reason as string]))
  const publishedSlugs = new Map((publishedToday ?? []).map(s => [s.slug, s]))

  // Classify each candidate
  type Decision = 'published' | 'review' | 'hold' | 'rejected' | 'pending'
  function getDecision(slug: string, processed: boolean): Decision {
    const pub = publishedSlugs.get(slug)
    if (pub) {
      if (pub.qc_status === 'hold') return 'hold'
      return pub.display_order === 75 ? 'review' : 'published'
    }
    if (rejectedSlugs.has(slug)) return 'rejected'
    if (processed) return 'rejected' // processed but not in stories or rejected_slugs = rejected without reason
    return 'pending'
  }

  const decisionPriority: Record<Decision, number> = {
    hold: 0,
    review: 1,
    published: 2,
    rejected: 3,
    pending: 4,
  }
  const orderedCandidates = [...(candidates ?? [])].sort((a, b) => {
    const decisionA = getDecision(a.slug, a.processed)
    const decisionB = getDecision(b.slug, b.processed)
    return decisionPriority[decisionA] - decisionPriority[decisionB]
      || new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime()
  })

  const candidateSlugSet = new Set((candidates ?? []).map(c => c.slug))
  const publishedFromCandidates = (publishedToday ?? []).filter(s => candidateSlugSet.has(s.slug))

  const stats = {
    fetched: candidates?.length ?? 0,
    published: publishedFromCandidates.filter(s => s.qc_status !== 'hold' && s.display_order !== 75).length,
    review: publishedFromCandidates.filter(s => s.qc_status !== 'hold' && s.display_order === 75).length,
    held: publishedFromCandidates.filter(s => s.qc_status === 'hold').length,
    rejected: rejected?.length ?? 0,
    pending: (candidates ?? []).filter(c => !c.processed).length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">Pipeline, Last 24 Hours</h1>
        <IngestButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Fetched', value: stats.fetched, color: 'gray' as const },
          { label: 'Published', value: stats.published, color: 'green' as const },
          { label: 'Review', value: stats.review, color: 'amber' as const },
          { label: 'QC Hold', value: stats.held, color: 'red' as const },
          { label: 'Rejected', value: stats.rejected, color: 'red' as const },
          { label: 'Pending', value: stats.pending, color: 'gray' as const },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded p-3">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Candidate table */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-8">#</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Title</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-24">Source</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-20">Platform</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-20">Score</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-24">Decision</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orderedCandidates.map((c, i) => {
              const decision = getDecision(c.slug, c.processed)
              const reason = rejectedSlugs.get(c.slug) ?? ''
              const badgeColor = { published: 'green', review: 'amber', hold: 'red', rejected: 'red', pending: 'gray' }[decision] as 'green' | 'amber' | 'red' | 'gray'
              return (
                <tr key={c.slug} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium leading-snug">{c.title}</div>
                    {c.journalist_username && (
                      <div className="text-muted-foreground mt-0.5">@{c.journalist_username}</div>
                    )}
                    {c.region && (
                      <div className="text-muted-foreground mt-0.5">{c.region}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[96px]">{c.source}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.platform}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {c.viral_score?.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={decision} color={badgeColor} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground leading-snug max-w-xs">
                    {reason ? (
                      <span className="line-clamp-2">{reason}</span>
                    ) : decision === 'hold' ? (
                      <a href="/admin/qc-holds" className="text-[oklch(0.52_0.14_196)] hover:underline">
                        Review in QC Holds →
                      </a>
                    ) : decision === 'published' ? (
                      <a href={`/story/${c.slug}`} className="text-[oklch(0.52_0.14_196)] hover:underline" target="_blank" rel="noopener noreferrer">
                        View story →
                      </a>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {(candidates ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No candidates fetched in the last 24 hours. Run Fetch first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
