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
    <div className="mt-4 border-t border-[#E2E8F0] pt-3">
      <p className="text-xs text-[#64748B] mb-2">Did this feel useful, agenda-driven, or unclear?</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              selected === option
                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                : 'border-[#CBD5E1] bg-white text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
