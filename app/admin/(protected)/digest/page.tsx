'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function DigestAdminPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleGenerate() {
    setStatus('loading')
    setMessage('')
    const res = await fetch('/api/admin/digest', { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setStatus('done')
      setMessage(`Digest generated for ${json.date}. View it at /digest`)
    } else {
      setStatus('error')
      setMessage(json.error ?? 'Unknown error')
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-black tracking-tight mb-1">Daily Digest</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Generate today&apos;s digest from all published stories. This calls Claude and takes ~10 seconds.
        Regenerating will overwrite today&apos;s digest.
      </p>

      <div className="p-5 border border-border rounded-md bg-white space-y-4">
        <Button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="font-semibold"
        >
          {status === 'loading' ? 'Generating…' : 'Generate Digest'}
        </Button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-destructive' : 'text-green-700'}`}>
            {message}
          </p>
        )}

        {status === 'done' && (
          <a
            href="/digest"
            target="_blank"
            className="block text-sm font-medium underline text-foreground"
          >
            Open digest →
          </a>
        )}
      </div>
    </div>
  )
}
