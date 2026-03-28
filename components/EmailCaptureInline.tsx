'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

export default function EmailCaptureInline({ nudge = false }: { nudge?: boolean }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        track('signup_completed', { placement: nudge ? 'nudge' : 'inline' })
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

  if (nudge) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs text-muted-foreground">Enjoying this?</span>
        <input
          type="email"
          placeholder="your@email.com"
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
          Get it daily
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mt-3">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)]"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="text-sm font-semibold px-4 py-2 rounded bg-[oklch(0.52_0.14_196)] text-white hover:opacity-80 transition-opacity shrink-0 disabled:opacity-50"
      >
        {status === 'loading' ? '...' : 'Get daily briefing'}
      </button>
      {status === 'error' && (
        <span className="text-xs text-red-500 sm:self-center">Try again</span>
      )}
    </form>
  )
}
