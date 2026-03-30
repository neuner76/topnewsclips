'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function DigestAdminPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [sendEmail, setSendEmail] = useState(false)

  async function handleGenerate() {
    setStatus('loading')
    setMessage('')
    const res = await fetch('/api/admin/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendEmail }),
    })
    const json = await res.json()
    if (res.ok) {
      setStatus('done')
      setMessage(json.message)
    } else {
      setStatus('error')
      setMessage(json.error ?? 'Unknown error')
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-black tracking-tight mb-1">Daily Digest</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Triggers the GitHub Actions digest workflow. Takes ~2 minutes to complete — check{' '}
        <a
          href={`https://github.com/neuner76/topnewsclips/actions/workflows/digest.yml`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          GitHub Actions
        </a>{' '}
        for progress.
      </p>

      <div className="p-5 border border-border rounded-md bg-card space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="rounded"
          />
          Send email to subscribers after generating
        </label>

        <Button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="font-semibold"
        >
          {status === 'loading' ? 'Triggering…' : 'Generate Digest'}
        </Button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-destructive' : 'text-green-700'}`}>
            {message}
          </p>
        )}

        {status === 'done' && (
          <a
            href="https://github.com/neuner76/topnewsclips/actions/workflows/digest.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-medium underline text-foreground"
          >
            View workflow run →
          </a>
        )}
      </div>
    </div>
  )
}
