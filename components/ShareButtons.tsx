'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { track } from '@/lib/analytics'

interface ShareButtonsProps {
  title: string
  slug: string
}

export default function ShareButtons({ title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const baseUrl = `https://www.topnewsclips.com/story/${slug}`
  const shareUrl = `${baseUrl}?utm_source=social&utm_medium=share&utm_campaign=story`
  const tweetText = encodeURIComponent(`${title}\n\nvia @TopNewsClips — stories mainstream media isn't covering\n${shareUrl}`)

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    track('story_shared', { method: 'copy', slug })
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium px-2.5 py-1.5 rounded border border-border hover:bg-muted transition-colors"
        onClick={() => track('story_shared', { method: 'x', slug })}
      >
        Share on X
      </a>
      <button
        onClick={copyLink}
        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded border border-border hover:bg-muted transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Share2 className="w-3 h-3" />
            Copy link
          </>
        )}
      </button>
    </div>
  )
}
