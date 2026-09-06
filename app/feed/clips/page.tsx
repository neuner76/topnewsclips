import type { Metadata } from 'next'
import { FeedPage } from '../FeedPage'

// Clips view — static/ISR, split out from /feed so both views are CDN-cacheable
// (neither reads searchParams). Was previously /feed?view=clips.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Clips — Top News Clips',
  description: 'A clip-first view of the news with visible source labels, confidence markers, and undercovered stories worth your attention.',
}

export default function Page() {
  return <FeedPage preferredView="clips" />
}
