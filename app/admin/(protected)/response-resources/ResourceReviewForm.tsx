'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function sourcesToText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map(item => typeof item === 'string' ? item : JSON.stringify(item))
    .join('\n')
}

export default function ResourceReviewForm({ resourceId, currentStatus, currentReason, currentRisk, currentVerificationSources }: {
  resourceId: string
  currentStatus: string
  currentReason: string | null
  currentRisk: string
  currentVerificationSources: unknown
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [reason, setReason] = useState(currentReason ?? '')
  const [riskLevel, setRiskLevel] = useState(currentRisk)
  const [verificationSources, setVerificationSources] = useState(sourcesToText(currentVerificationSources))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if ((status === 'approved' || status === 'rejected') && reason.trim().length < 10) {
      setError('Add a reason before saving a decision.')
      return
    }
    const verificationSourceList = verificationSources.split('\n').map(s => s.trim()).filter(Boolean)
    if (status === 'approved' && verificationSourceList.length === 0) {
      setError('Add at least one verification source before approving.')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/response-resources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: resourceId,
        approval_status: status,
        reason_listed: reason.trim(),
        risk_level: riskLevel,
        verification_sources: verificationSourceList,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === 'string' ? data.error : 'Failed to save.')
      setSaving(false)
      return
    }

    router.refresh()
    setSaving(false)
  }

  return (
    <div className="border border-border rounded p-3 bg-muted/30 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Decision</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background">
            <option value="proposed">Proposed</option>
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
            <option value="retired">Retire</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Risk level</label>
          <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason listed</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background resize-none"
          placeholder="Why this resource is connected to the issue and safe to list."
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Verification sources</label>
        <textarea
          value={verificationSources}
          onChange={e => setVerificationSources(e.target.value)}
          rows={2}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background resize-none"
          placeholder="One source URL or note per line."
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button onClick={save} disabled={saving} className="text-xs font-semibold px-4 py-1.5 rounded bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50">
        {saving ? 'Saving...' : 'Save review'}
      </button>
    </div>
  )
}
