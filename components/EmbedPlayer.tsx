'use client'

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

export default function EmbedPlayer({ embedUrl, platform, title }: EmbedPlayerProps) {
  if (platform === 'youtube') {
    const videoId = getYouTubeId(embedUrl)
    if (!videoId) return <EmbedFallback url={embedUrl} />
    return (
      <div className="relative w-full aspect-video rounded overflow-hidden bg-zinc-100">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
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
          style={{ maxWidth: 605, minWidth: 325 }}
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
    <div className="w-full aspect-video rounded bg-zinc-100 flex items-center justify-center">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground underline"
      >
        View original clip
      </a>
    </div>
  )
}
