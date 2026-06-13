'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QuestionReviewForm({ questionId, currentStatus, currentNotes }: {
  questionId: string
  currentStatus: string
  currentNotes: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/reader-questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: questionId, status, moderation_notes: notes.trim() || null }),
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
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="answered">Answered</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Moderation notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background resize-none" />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button onClick={save} disabled={saving} className="text-xs font-semibold px-4 py-1.5 rounded bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50">
        {saving ? 'Saving...' : 'Save question'}
      </button>
    </div>
  )
}
