import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Top News Clips — Independent News. No Agenda.',
  description:
    'Independent news clips and journalism mainstream media undercovers. Bodycam footage, investigative reporting, and global stories — unfiltered.',
  metadataBase: new URL('https://www.topnewsclips.com'),
  alternates: {
    canonical: 'https://www.topnewsclips.com',
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
        {children}
      </body>
    </html>
  )
}
