'use client'

import { useState } from 'react'

const TIERS = [
  { value: 1,  label: '1 — Nonprofit Investigative (ProPublica, Marshall Project)' },
  { value: 2,  label: '2 — OSINT (Bellingcat)' },
  { value: 3,  label: '3 — Public Broadcaster (DW, Al Jazeera, France 24)' },
  { value: 4,  label: '4 — Independent News Org (The Intercept, Drop Site)' },
  { value: 5,  label: '5 — Wire Service (Reuters, AP)' },
  { value: 6,  label: '6 — Commercial / Explainer (Vox, Journeyman)' },
  { value: 7,  label: '7 — Independent Commentary' },
  { value: 8,  label: '8 — State Media' },
  { value: 9,  label: '9 — Raw Footage' },
  { value: 10, label: '10 — Community Sourced' },
]

export default function SubmitForm() {
  const [channelUrl, setChannelUrl] = useState('')
  const [reason, setReason] = useState('')
  const [suggestedTier, setSuggestedTier] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/recommend-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_url: channelUrl,
          reason,
          suggested_tier: suggestedTier ? Number(suggestedTier) : null,
          submitter_email: email || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage("Submitted. Your recommendation will appear in the review log once it enters the queue.")
        setChannelUrl('')
        setReason('')
        setSuggestedTier('')
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

  if (status === 'success') {
    return (
      <div className="p-5 border border-[oklch(0.88_0.07_145)] bg-[oklch(0.96_0.03_145)] rounded-lg text-sm text-[oklch(0.38_0.13_145)]">
        <p className="font-semibold mb-1">✓ Recommendation received</p>
        <p>{message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
          Channel or outlet URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={channelUrl}
          onChange={e => setChannelUrl(e.target.value)}
          placeholder="https://www.youtube.com/@channelname"
          required
          className="w-full text-sm px-3 py-2.5 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)]"
        />
        <p className="text-xs text-muted-foreground mt-1">YouTube channel, website, or social profile URL.</p>
      </div>

      <div>
        <label className="block text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
          Why it belongs <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="One or two sentences: what does this source cover, and why does it meet the bar for independent journalism?"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          className="w-full text-sm px-3 py-2.5 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)] resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{reason.length}/500</p>
      </div>

      <div>
        <label className="block text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
          Suggested tier <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
        </label>
        <select
          value={suggestedTier}
          onChange={e => setSuggestedTier(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)]"
        >
          <option value="">— Not sure</option>
          {TIERS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          We&apos;ll evaluate this independently — your suggestion helps us understand how you see the source.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
          Your email <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full text-sm px-3 py-2.5 rounded border border-border bg-background focus:outline-none focus:border-[oklch(0.52_0.14_196)]"
        />
        <p className="text-xs text-muted-foreground mt-1">
          We&apos;ll notify you when your submission is reviewed. Not shared or used for anything else.
        </p>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full sm:w-auto text-sm font-semibold px-6 py-2.5 rounded bg-[oklch(0.52_0.14_196)] text-white hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {status === 'loading' ? 'Submitting…' : 'Submit recommendation'}
      </button>
    </form>
  )
}
