'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { track } from '@/lib/analytics'

type TrackValue = string | number | boolean | null | undefined

interface FeedStoryLinkProps {
  href: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  event?: 'feed_story_click' | 'feed_full_story_click' | 'feed_clip_click'
  properties: Record<string, TrackValue>
}

export default function FeedStoryLink({
  href,
  children,
  className,
  style,
  event = 'feed_story_click',
  properties,
}: FeedStoryLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={() => track(event, properties)}
    >
      {children}
    </Link>
  )
}
