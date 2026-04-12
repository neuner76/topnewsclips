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
    <section id="subscribe" className="bg-foreground text-background rounded-lg px-6 py-8 sm:px-10 sm:py-10 my-12">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
          The full picture, not the profitable picture.
        </h2>
        <p className="text-sm text-background/70 mb-6">
          A daily briefing where every source is labeled, what US media skips gets surfaced, and no one&apos;s selling you outrage. Free.
        </p>

        {status === 'success' ? (
          <p className="text-sm font-medium text-background/90 bg-background/10 rounded px-4 py-3">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/10 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-background/30"
            />
            <Button
              type="submit"
              disabled={status === 'loading'}
              className="bg-background text-foreground hover:bg-background/90 font-semibold shrink-0"
            >
              {status === 'loading' ? 'Joining...' : 'Join Free'}
            </Button>
          </form>
        )}

        {status === 'error' && (
          <p className="text-xs text-background/60 mt-2">{message}</p>
        )}
      </div>
    </section>
  )
}
