import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import PostHogProvider from '@/components/PostHogProvider'
import './globals.css'

const SITE_URL = 'https://www.topnewsclips.com'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: 'Top News Clips — The Full Picture, Not the Profitable Picture',
  description:
    'A daily news briefing founded by Eric Neuner, surfaces verified stories mainstream media underreports, shows how the world covers today\'s events, and labels every source by source tier.',
  metadataBase: new URL('https://www.topnewsclips.com'),
  alternates: {
    canonical: 'https://www.topnewsclips.com',
    types: {
      'application/rss+xml': `${SITE_URL}/rss.xml`,
    },
  },
  openGraph: {
    title: 'Top News Clips — The Full Picture, Not the Profitable Picture',
    description: 'The full picture, not the profitable picture. Daily briefing where every source is labeled, every story is placed in context, and the full picture fits in 5 minutes.',
    url: 'https://www.topnewsclips.com',
    siteName: 'Top News Clips',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top News Clips — The Full Picture, Not the Profitable Picture',
    description: 'The full picture, not the profitable picture. Daily briefing where every source is labeled, every story is placed in context, and the full picture fits in 5 minutes.',
    site: '@topnewsclips',
  },
  verification: {
    other: { 'msvalidate.01': '08924073E1E743D11B79FA73E1244BB3' },
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Top News Clips',
  url: 'https://www.topnewsclips.com',
  description: 'A daily news briefing that surfaces verified stories mainstream media underreports and labels every source by source tier.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.topnewsclips.com/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Light-only by design (it's a morning brief, and it matches the emailed
    // edition). The site renders with the default light `:root` tokens; surfaces
    // use semantic color tokens (text-foreground / text-muted-foreground /
    // border-border) rather than hardcoded colors. suppressHydrationWarning guards
    // against extensions mutating <html>.
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
