'use client'

import { useEffect, useRef, useState } from 'react'
import type { Platform } from '@/lib/types'

interface EmbedPlayerProps {
  embedUrl: string
  platform: Platform
  title: string
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function getTikTokId(url: string): string | null {
  // Handle tiktok.com/@user/video/ID
  const m1 = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (m1) return m1[1]
  // Handle tiktokv.com/share/video/ID or tiktok.com/share/video/ID
  const m2 = url.match(/tiktokv?\.com\/(?:share\/)?video\/(\d+)/)
  if (m2) return m2[1]
  return null
}

function YouTubeEmbed({ videoId, embedUrl, title }: { videoId: string; embedUrl: string; title: string }) {
  const [blocked, setBlocked] = useState(false)
  const [activated, setActivated] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isShort = embedUrl.includes('/shorts/')

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.origin !== 'https://www.youtube.com') return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        // Error codes 101 and 150 = embed blocked by rights holder / owner
        if (data?.event === 'onError' && (data?.info === 101 || data?.info === 150)) {
          setBlocked(true)
        }
      } catch { /* ignore non-JSON messages */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (blocked) return <EmbedFallback url={`https://www.youtube.com/watch?v=${videoId}`} />

  const containerClass = isShort
    ? "relative mx-auto rounded-xl overflow-hidden bg-zinc-100 w-full max-w-[340px] aspect-[9/16]"
    : "relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-100"

  // Facade: paint the thumbnail + play button first (instant LCP, no heavy YouTube
  // iframe on load). Tapping swaps in the real player with autoplay — still one tap
  // to watch, but the page lands immediately on the frame readers came for.
  if (!activated) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        aria-label={`Play video: ${title}`}
        className={`${containerClass} group block cursor-pointer`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
          alt={title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center w-16 h-11 rounded-xl bg-[#FF0000] shadow-lg group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className={containerClass}>
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

export default function EmbedPlayer({ embedUrl, platform, title }: EmbedPlayerProps) {
  if (platform === 'youtube') {
    const videoId = getYouTubeId(embedUrl)
    if (!videoId) return <EmbedFallback url={embedUrl} />
    return <YouTubeEmbed videoId={videoId} embedUrl={embedUrl} title={title} />
  }

  if (platform === 'tiktok') {
    const videoId = getTikTokId(embedUrl)
    if (!videoId) return <EmbedFallback url={embedUrl} />
    return (
      <div className="flex justify-center">
        <blockquote
          className="tiktok-embed"
          cite={embedUrl}
          data-video-id={videoId}
          style={{ maxWidth: 605, minWidth: 0, width: '100%' }}
        >
          <section />
        </blockquote>
        <script async src="https://www.tiktok.com/embed.js" />
      </div>
    )
  }

  if (platform === 'x') {
    // X embeds require a client-side tweet ID extraction
    const tweetMatch = embedUrl.match(/status\/(\d+)/)
    if (!tweetMatch) return <EmbedFallback url={embedUrl} />
    return (
      <div className="flex justify-center">
        <blockquote className="twitter-tweet" data-dnt="true">
          <a href={embedUrl} />
        </blockquote>
        <script async src="https://platform.twitter.com/widgets.js" />
      </div>
    )
  }

  return <EmbedFallback url={embedUrl} />
}

function EmbedFallback({ url }: { url: string }) {
  return (
    <div className="w-full aspect-video rounded bg-zinc-100 flex flex-col items-center justify-center gap-2">
      <p className="text-sm text-muted-foreground">This video can&apos;t be embedded here.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-[#2563EB] hover:underline"
      >
        Watch on YouTube →
      </a>
    </div>
  )
}
