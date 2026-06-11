'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  storyId: string
  initialTitle: string
  initialDescription: string
}

export default function HoldReviewForm({ storyId, initialTitle, initialDescription }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [saving, setSaving] = useState<'publish' | 'discard' | null>(null)
  const [error, setError] = useState('')

  async function act(action: 'publish' | 'discard') {
    if (action === 'discard' && !confirm('Discard this story permanently? This cannot be undone.')) return
    setSaving(action)
    setError('')
    try {
      const res = await fetch('/api/admin/qc-holds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storyId, action, title, description }),
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
      setSaving(null)
    }
  }

  return (
    <div className="border border-border rounded p-3 bg-muted/30 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Headline</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Summary</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => act('publish')}
          disabled={saving !== null}
          className="text-xs font-semibold px-4 py-1.5 rounded bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {saving === 'publish' ? 'Publishing…' : 'Fix & publish'}
        </button>
        <button
          onClick={() => act('discard')}
          disabled={saving !== null}
          className="text-xs font-semibold px-4 py-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {saving === 'discard' ? 'Discarding…' : 'Discard'}
        </button>
      </div>
    </div>
  )
}
