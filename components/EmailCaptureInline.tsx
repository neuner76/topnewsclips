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
        <p className="text-xs font-medium text-[#2563EB]">
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
          className="flex-1 text-sm px-3 py-2 rounded border border-[#CBD5E1] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 min-w-0"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="text-sm font-semibold px-4 py-2 rounded bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 transition-colors shrink-0 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Get the digest'}
        </button>
      </form>
      <p className="text-[11px] text-[#64748B] mt-1.5">Free. No spam. Unsubscribe anytime.</p>
      {status === 'error' && (
        <p className="text-xs text-red-500 mt-1">Something went wrong, try again.</p>
      )}
    </div>
  )
}
