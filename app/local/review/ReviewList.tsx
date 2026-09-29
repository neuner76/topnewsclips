'use client'

import { useState } from 'react'
import type { HeldEventView } from '@/lib/local/review'

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ReviewList({ initial }: { initial: HeldEventView[] }) {
  const [events, setEvents] = useState(initial)
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [errored, setErrored] = useState<Record<string, string>>({})

  async function act(id: string, action: 'publish' | 'reject') {
    setPending(p => ({ ...p, [id]: true }))
    setErrored(e => { const n = { ...e }; delete n[id]; return n })
    try {
      const res = await fetch(`/api/local/events/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setEvents(list => list.filter(e => e.id !== id)) // remove the decided event
    } catch (err) {
      setErrored(e => ({ ...e, [id]: err instanceof Error ? err.message : 'Failed' }))
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n })
    }
  }

  if (events.length === 0) {
    return <p className="rounded-lg border border-[#EFF2F6] bg-[#FAFBFC] px-4 py-8 text-center text-sm text-muted-foreground">All caught up — queue cleared.</p>
  }

  return (
    <ul className="space-y-3">
      {events.map(e => {
        const src = e.sources.find(s => s.url) ?? e.sources[0]
        const when = formatWhen(e.firstDetectedAt)
        const busy = !!pending[e.id]
        return (
          <li key={e.id} className="rounded-lg border border-[#EFF2F6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#475569]">{e.typeLabel}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">importance {e.importance}</span>
                  {e.verificationStatus && <span className="text-[11px] text-muted-foreground">· {e.verificationStatus}</span>}
                  {e.geoPrecision && <span className="text-[11px] text-muted-foreground">· {e.geoPrecision}</span>}
                </div>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">
                  {src?.url
                    ? <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2563EB]">{e.headline} <span aria-hidden className="text-muted-foreground">→</span></a>
                    : e.headline}
                </p>
                {e.summary && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.summary}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  {src && <span>{src.label}</span>}
                  {when && <span>· detected {when}</span>}
                  {e.publishReason && <span>· held: {e.publishReason}</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => act(e.id, 'publish')}
                disabled={busy}
                className="rounded-md bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-50"
              >
                {busy ? '…' : 'Publish'}
              </button>
              <button
                onClick={() => act(e.id, 'reject')}
                disabled={busy}
                className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#475569] transition-colors hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Reject
              </button>
              {errored[e.id] && <span className="text-[11px] text-red-600">{errored[e.id]}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
