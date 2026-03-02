'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface ShareButtonsProps {
  title: string
  slug: string
}

export default function ShareButtons({ title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const url = `https://topnewsclips.com/story/${slug}`
  const tweetText = encodeURIComponent(`${title} — via @TopNewsClips\n${url}`)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium px-2.5 py-1.5 rounded border border-border hover:bg-muted transition-colors"
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
