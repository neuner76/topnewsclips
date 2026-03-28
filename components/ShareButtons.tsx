'use client'

import { useState, useEffect } from 'react'
import { track } from '@/lib/analytics'

interface ShareButtonsProps {
  title: string
  slug: string
}

export default function ShareButtons({ title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share)
  }, [])

  const baseUrl = `https://www.topnewsclips.com/story/${slug}`
  const shareUrl = `${baseUrl}?utm_source=social&utm_medium=share&utm_campaign=story`
  const shareText = `${title}\n\nvia @TopNewsClips — stories mainstream media isn't covering`
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: shareText, url: shareUrl })
      track('story_shared', { method: 'native', slug })
    } catch {
      // user cancelled — no-op
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      track('story_shared', { method: 'copy', slug })
    } catch {
      // fallback for browsers without clipboard API
      const el = document.createElement('input')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      track('story_shared', { method: 'copy', slug })
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Native share — mobile only, shown when API available */}
      {canNativeShare && (
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border border-[oklch(0.52_0.14_196)] text-[oklch(0.52_0.14_196)] hover:bg-[oklch(0.96_0.02_196)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      )}

      {/* X / Twitter */}
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
        onClick={() => track('story_shared', { method: 'x', slug })}
      >
        Post on X
      </a>

      {/* WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
        onClick={() => track('story_shared', { method: 'whatsapp', slug })}
      >
        WhatsApp
      </a>

      {/* Copy link */}
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-green-600">Copied</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  )
}
