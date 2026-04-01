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

  return (
    <div className={isShort
      ? "relative mx-auto rounded overflow-hidden bg-zinc-100 w-full max-w-[340px] aspect-[9/16]"
      : "relative w-full aspect-video rounded overflow-hidden bg-zinc-100"
    }>
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`}
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
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
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
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
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
        className="text-sm font-semibold text-[oklch(0.52_0.14_196)] hover:underline"
      >
        Watch on YouTube →
      </a>
    </div>
  )
}
