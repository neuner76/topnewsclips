'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

export default function EmailCaptureInline({ placement = 'inline' }: { placement?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const startedRef = useRef(false)

  useEffect(() => {
    track('signup_impression', { placement })
  }, [placement])

  function handleFocus() {
    if (!startedRef.current) {
      startedRef.current = true
      track('signup_started', { placement })
    }
  }

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
      <div className="mt-3">
        <p className="text-xs font-medium text-[oklch(0.52_0.14_196)]">
          ✓ You&apos;re in, check your inbox.
        </p>
        <Link
          href="/digest"
          className="inline-block mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          See today&apos;s briefing →
        </Link>
      </div>
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
          onFocus={handleFocus}
          required
          className="flex-1 text-sm px-3 py-2 rounded border border-white/20 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[oklch(0.52_0.14_196)] min-w-0"
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
        <p className="text-xs text-red-500 mt-1">Something went wrong, try again.</p>
      )}
    </div>
  )
}
