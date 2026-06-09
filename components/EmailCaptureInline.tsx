'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

export default function EmailCaptureInline({ placement = 'inline' }: { placement?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(ref ? { ref } : {}) }),
      })
      if (res.ok) {
        track('signup_completed', { placement })
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p className="text-xs font-medium text-[oklch(0.52_0.14_196)] mt-3">
        ✓ You&apos;re in — check your inbox.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)] min-w-0"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="text-sm font-semibold px-4 py-2 rounded bg-[oklch(0.52_0.14_196)] text-white hover:opacity-80 transition-opacity shrink-0 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Get the digest'}
        </button>
      </form>
      <p className="text-[11px] text-muted-foreground mt-1.5">Free. No spam. Unsubscribe anytime.</p>
      {status === 'error' && (
        <p className="text-xs text-red-500 mt-1">Something went wrong — try again.</p>
      )}
    </div>
  )
}
