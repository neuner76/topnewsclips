'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

const OPTIONS = ['Useful', 'Agenda-driven', 'Unclear'] as const

export default function ResponseFeedback({ storySlug, storyCategory, eligibility }: {
  storySlug: string
  storyCategory: string
  eligibility: string
}) {
  const [selected, setSelected] = useState<string | null>(null)

  function choose(value: string) {
    setSelected(value)
    track('response_feedback_submitted', {
      story_slug: storySlug,
      story_category: storyCategory,
      response_eligibility: eligibility,
      feedback: value.toLowerCase(),
      surface: 'story_page',
    })
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] text-muted-foreground mb-2">Did this feel useful, agenda-driven, or unclear?</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              selected === option
                ? 'border-[#14b8a6] bg-[#14b8a6]/15 text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-muted-foreground'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
