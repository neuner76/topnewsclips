'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function DigestAdminPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [sendEmail, setSendEmail] = useState(false)

  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [previewMessage, setPreviewMessage] = useState('')
  const [previewEmail, setPreviewEmail] = useState('neuner@gmail.com')

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

  async function handleSendPreview() {
    setPreviewStatus('loading')
    setPreviewMessage('')
    const res = await fetch(`/api/admin/preview-digest?sendTo=${encodeURIComponent(previewEmail)}`)
    if (res.ok) {
      setPreviewStatus('done')
      setPreviewMessage(`Preview sent to ${previewEmail}`)
    } else {
      setPreviewStatus('error')
      const text = await res.text().catch(() => 'Unknown error')
      setPreviewMessage(text)
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight mb-1">Daily Digest</h1>
        <p className="text-sm text-muted-foreground">
          Triggers the GitHub Actions digest workflow. Takes ~2 minutes to complete, check{' '}
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
      </div>

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

      <div className="p-5 border border-border rounded-md bg-card space-y-4">
        <div>
          <p className="text-sm font-semibold mb-0.5">Preview Email</p>
          <p className="text-xs text-muted-foreground">Renders today&apos;s digest using the current template.</p>
        </div>

        <a
          href="/api/admin/preview-digest"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline underline-offset-2"
        >
          Open browser preview →
        </a>

        <div className="pt-2 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground">Or send a test email:</p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={previewEmail}
              onChange={e => setPreviewEmail(e.target.value)}
              className="text-sm h-9"
              placeholder="you@example.com"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendPreview}
              disabled={previewStatus === 'loading' || !previewEmail}
              className="shrink-0 font-semibold"
            >
              {previewStatus === 'loading' ? 'Sending…' : 'Send to me'}
            </Button>
          </div>

          {previewMessage && (
            <p className={`text-sm ${previewStatus === 'error' ? 'text-destructive' : 'text-green-700'}`}>
              {previewMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
