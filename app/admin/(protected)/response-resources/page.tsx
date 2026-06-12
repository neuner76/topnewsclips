import { createClient } from '@supabase/supabase-js'
import ResourceReviewForm from './ResourceReviewForm'

export const revalidate = 0

interface ResourceRow {
  id: string
  created_at: string
  response_type: string
  title: string
  description: string
  url: string
  story_category: string | null
  issue_area: string | null
  region: string | null
  approval_status: string
  reason_listed: string | null
  risk_level: string
  verification_sources: unknown
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'text-amber-700 bg-amber-50 dark:bg-amber-950/20',
  approved: 'text-green-700 bg-green-50 dark:bg-green-950/20',
  rejected: 'text-blue-700 bg-blue-50 dark:bg-blue-950/20',
  retired: 'text-muted-foreground bg-muted',
}

export default async function ResponseResourcesPage() {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('verified_response_resources')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const resources = (data ?? []) as ResourceRow[]
  const pending = resources.filter(r => r.approval_status === 'proposed')
  const reviewed = resources.filter(r => r.approval_status !== 'proposed')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Response Resources</h1>
        <a href="/response-taxonomy" target="_blank" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View public taxonomy →
        </a>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {['proposed', 'approved', 'rejected', 'retired'].map(status => (
          <div key={status} className="bg-card rounded border border-border p-4">
            <p className="text-2xl font-bold tabular-nums">{resources.filter(r => r.approval_status === status).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{status}</p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-3">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">No proposed resources.</p>
        ) : (
          <div className="bg-card rounded border border-border divide-y divide-border">
            {pending.map(resource => (
              <div key={resource.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline break-all">
                      {resource.title}
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {resource.response_type} · {resource.story_category ?? 'any category'} · {resource.region ?? 'any region'} · {formatDate(resource.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[resource.approval_status]}`}>
                    {resource.approval_status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{resource.description}</p>
                {resource.issue_area && <p className="text-xs text-muted-foreground mb-4">Issue area: {resource.issue_area}</p>}
                <ResourceReviewForm resourceId={resource.id} currentStatus={resource.approval_status} currentReason={resource.reason_listed} currentRisk={resource.risk_level} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Reviewed ({reviewed.length})</h2>
        <div className="bg-card rounded border border-border divide-y divide-border">
          {reviewed.map(resource => (
            <div key={resource.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline break-all">
                  {resource.title}
                </a>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[resource.approval_status]}`}>
                  {resource.approval_status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{resource.response_type} · {resource.risk_level} risk</p>
              {resource.reason_listed && <p className="text-xs text-muted-foreground mt-1 italic">{resource.reason_listed}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
