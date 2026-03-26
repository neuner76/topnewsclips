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
  title: 'Top News Clips — Independent News. No Agenda.',
  description:
    'Independent news clips and journalism mainstream media undercovers. Bodycam footage, investigative reporting, and global stories — unfiltered.',
  metadataBase: new URL('https://www.topnewsclips.com'),
  alternates: {
    canonical: 'https://www.topnewsclips.com',
    types: {
      'application/rss+xml': `${SITE_URL}/rss.xml`,
    },
  },
  openGraph: {
    title: 'Top News Clips — Independent News. No Agenda.',
    description: 'Independent news clips mainstream media undercovers.',
    url: 'https://www.topnewsclips.com',
    siteName: 'Top News Clips',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top News Clips — Independent News. No Agenda.',
    description: 'Independent news clips mainstream media undercovers.',
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
  description: 'Independent news clips and journalism mainstream media undercovers.',
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
    <html lang="en">
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
