'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

export default function ReaderQuestionBox({ storySlug, storyId, storyCategory, eligibility }: {
  storySlug: string
  storyId: string
  storyCategory: string
  eligibility: string
}) {
  const [question, setQuestion] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (question.trim().length < 8) {
      setError('Please ask a little more detail.')
      return
    }
    setStatus('submitting')
    setError(null)
    track('reader_question_started', { story_slug: storySlug, story_category: storyCategory, response_eligibility: eligibility, surface: 'story_page' })

    const res = await fetch('/api/reader-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story_slug: storySlug, story_id: storyId, question, email, website }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus('error')
      setError(typeof data.error === 'string' ? data.error : 'Could not submit right now.')
      return
    }

    track('reader_question_submitted', { story_slug: storySlug, story_category: storyCategory, response_eligibility: eligibility, surface: 'story_page' })
    setStatus('submitted')
    setQuestion('')
    setEmail('')
  }

  if (status === 'submitted') {
    return (
      <p className="text-sm text-muted-foreground">
        Thanks. We&apos;ll use reader questions to guide follow-up coverage.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-muted-foreground" htmlFor="reader-question">
        What do you still want to understand?
      </label>
      <textarea
        id="reader-question"
        value={question}
        onChange={e => setQuestion(e.target.value.slice(0, 500))}
        placeholder="What is still unclear?"
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
        rows={3}
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email optional"
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
      />
      <input
        value={website}
        onChange={e => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={status === 'submitting'}
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition-opacity disabled:opacity-50"
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit question'}
        </button>
        <span className="text-[11px] text-muted-foreground">Questions are reviewed before any public use.</span>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
