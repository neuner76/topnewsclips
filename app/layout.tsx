import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Top News Clips — The Stories Mainstream Media Ignores',
  description:
    "The viral stories rocking social media that mainstream outlets won't touch. Real clips. Real engagement. No gatekeeping.",
  metadataBase: new URL('https://topnewsclips.com'),
  openGraph: {
    title: 'Top News Clips',
    description: 'The viral stories mainstream media ignores.',
    url: 'https://topnewsclips.com',
    siteName: 'Top News Clips',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top News Clips',
    description: 'The viral stories mainstream media ignores.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  )
}
