'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function EmailCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

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
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage("You're in. We'll send you the stories that matter.")
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <section id="subscribe" className="bg-[#F8FAFC] border border-[#D8E0EA] text-foreground rounded-lg px-6 py-8 sm:px-10 sm:py-10 my-12">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-[#111827]">
          Get the full picture in 5 minutes.
        </h2>
        <p className="text-sm text-[#64748B] mb-6">
          Every source labeled. Every story in context. No spin, no outrage.
        </p>

        {status === 'success' ? (
          <p className="text-sm font-medium text-foreground bg-white border border-[#D8E0EA] rounded px-4 py-3">
            {message}
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white border-[#CBD5E1] text-slate-950 placeholder:text-slate-500 focus-visible:ring-ring"
              />
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="bg-[#2563EB] text-white hover:bg-[#1d4ed8] font-semibold shrink-0"
              >
                {status === 'loading' ? '...' : 'Get the digest'}
              </Button>
            </form>
            <p className="text-xs text-[#64748B] mt-2 text-center">Free. No spam. Unsubscribe anytime.</p>
          </>
        )}

        {status === 'error' && (
          <p className="text-xs text-red-600 mt-2">{message}</p>
        )}
      </div>
    </section>
  )
}
