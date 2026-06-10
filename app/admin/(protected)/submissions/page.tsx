import { createClient as createServiceClient } from '@supabase/supabase-js'
import ReviewForm from './ReviewForm'

export const revalidate = 0

interface Submission {
  id: string
  created_at: string
  channel_url: string
  reason: string
  suggested_tier: number | null
  submitter_email: string | null
  status: string
  reviewed_at: string | null
  decision_tier: number | null
  decision_rationale: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  submitted:    'text-muted-foreground bg-muted',
  under_review: 'text-amber-700 bg-amber-50 dark:bg-amber-950/20',
  accepted:     'text-green-700 bg-green-50 dark:bg-green-950/20',
  declined:     'text-blue-700 bg-blue-50 dark:bg-blue-950/20',
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function SubmissionsPage() {
  const supabase = getServiceClient()

  const { data: submissions } = await supabase
    .from('source_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const all = (submissions ?? []) as Submission[]
  const pending = all.filter(s => s.status === 'submitted' || s.status === 'under_review')
  const reviewed = all.filter(s => s.status === 'accepted' || s.status === 'declined')

  const counts = {
    submitted: all.filter(s => s.status === 'submitted').length,
    under_review: all.filter(s => s.status === 'under_review').length,
    accepted: all.filter(s => s.status === 'accepted').length,
    declined: all.filter(s => s.status === 'declined').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Source Submissions</h1>
        <a
          href="/recommend-a-source"
          target="_blank"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View public page →
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'New', value: counts.submitted },
          { label: 'Under Review', value: counts.under_review },
          { label: 'Accepted', value: counts.accepted },
          { label: 'Declined', value: counts.declined },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded border border-border p-4">
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Pending queue */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-3">
          Pending Review
          {pending.length > 0 && (
            <span className="ml-2 text-amber-600">({pending.length})</span>
          )}
        </h2>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No pending submissions.
          </p>
        ) : (
          <div className="bg-card rounded border border-border divide-y divide-border">
            {pending.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <a
                      href={s.channel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:underline break-all"
                    >
                      {s.channel_url}
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted {formatDate(s.created_at)}
                      {s.suggested_tier && ` · Suggested Tier ${s.suggested_tier}`}
                      {s.submitter_email && ` · ${s.submitter_email}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[s.status]}`}>
                    {s.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{s.reason}</p>

                <ReviewForm submissionId={s.id} currentStatus={s.status} submitterEmail={s.submitter_email} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviewed log */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed submissions yet.</p>
        ) : (
          <div className="bg-card rounded border border-border divide-y divide-border">
            {reviewed.map(s => (
              <div key={s.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <a
                    href={s.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline break-all"
                  >
                    {s.channel_url}
                  </a>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[s.status]}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs mb-1">{s.reason}</p>
                <p className="text-xs text-muted-foreground/60">
                  Reviewed {s.reviewed_at ? formatDate(s.reviewed_at) : ''}
                  {s.decision_tier && ` · Tier ${s.decision_tier}`}
                </p>
                {s.decision_rationale && (
                  <p className="text-xs mt-1 text-muted-foreground italic">{s.decision_rationale}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
