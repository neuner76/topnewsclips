import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clips | Top News Clips',
  description: 'Scan the signal fast. A clip-first view of the news with visible source labels, confidence markers, and undercovered stories worth your attention.',
  alternates: { canonical: 'https://www.topnewsclips.com/clips' },
}

export default function ClipsPage() {
  redirect('/feed?view=clips')
}
