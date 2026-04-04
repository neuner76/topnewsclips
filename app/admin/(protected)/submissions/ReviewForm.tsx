'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  submissionId: string
  currentStatus: string
  submitterEmail: string | null
}

export default function ReviewForm({ submissionId, currentStatus, submitterEmail }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [tier, setTier] = useState('')
  const [rationale, setRationale] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!rationale.trim()) {
      setError('Rationale is required before saving a decision.')
      return
    }
    if ((status === 'accepted') && !tier) {
      setError('Please assign a tier for accepted sources.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId,
          status,
          decision_tier: tier ? Number(tier) : null,
          decision_rationale: rationale.trim(),
          submitter_email: submitterEmail,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-border rounded p-3 bg-muted/30 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Decision</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
          >
            <option value="submitted">Submitted (no action)</option>
            <option value="under_review">Mark Under Review</option>
            <option value="accepted">Accept</option>
            <option value="declined">Decline</option>
          </select>
        </div>

        {status === 'accepted' && (
          <div className="w-28">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Assign Tier</label>
            <select
              value={tier}
              onChange={e => setTier(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
            >
              <option value="">—</option>
              {[1,2,3,4,5,6,7,8,9,10].map(t => (
                <option key={t} value={t}>Tier {t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Rationale <span className="text-muted-foreground/60 font-normal">(shown publicly)</span>
        </label>
        <textarea
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          placeholder={status === 'declined'
            ? 'e.g. Declined — channel primarily produces entertainment rather than journalism.'
            : 'e.g. Accepted as Tier 7 Independent Commentary — consistent independent reporting on housing policy.'}
          rows={2}
          maxLength={300}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background resize-none focus:outline-none focus:border-[oklch(0.52_0.14_196)]"
        />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs font-semibold px-4 py-1.5 rounded bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save decision'}
      </button>
    </div>
  )
}
