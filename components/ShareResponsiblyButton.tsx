'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

export default function ShareResponsiblyButton({ title, slug, storyCategory, eligibility }: {
  title: string
  slug: string
  storyCategory: string
  eligibility: string
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `https://www.topnewsclips.com/story/${slug}?utm_source=social&utm_medium=share&utm_campaign=response_transparency`
  const shareText = [
    title,
    '',
    'Context: this is worth following, but details may depend on source coverage and future updates. Read the story and its labels before reacting.',
    '',
    shareUrl,
  ].join('\n')

  async function copyResponsibleShare() {
    try {
      await navigator.clipboard.writeText(shareText)
    } catch {
      const el = document.createElement('textarea')
      el.value = shareText
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    track('share_responsibly_clicked', {
      story_slug: slug,
      story_category: storyCategory,
      response_eligibility: eligibility,
      response_type: 'share_responsibly',
      surface: 'story_page',
    })
  }

  return (
    <button
      type="button"
      onClick={copyResponsibleShare}
      className="mt-2 text-sm font-semibold text-white/80 hover:text-white hover:underline underline-offset-2"
    >
      {copied ? 'Copied responsible share text' : 'Copy responsible share text →'}
    </button>
  )
}
