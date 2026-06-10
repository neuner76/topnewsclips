import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact | Top News Clips',
  description: 'Contact Top News Clips with story tips, corrections, press inquiries, or general feedback. We read everything.',
  alternates: { canonical: 'https://www.topnewsclips.com/contact' },
  openGraph: {
    title: 'Contact | Top News Clips',
    description: 'Contact Top News Clips with story tips, corrections, press inquiries, or general feedback.',
    url: 'https://www.topnewsclips.com/contact',
  },
  twitter: {
    card: 'summary',
    title: 'Contact | Top News Clips',
    description: 'Contact Top News Clips with story tips, corrections, press inquiries, or general feedback.',
    site: '@topnewsclips',
  },
}

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-white">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            {' › '}Contact
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Contact</h1>
          <p className="text-sm text-white/60 mt-2">
            The full picture, not the profitable picture.
          </p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-white/80">

          <div className="space-y-4">
            {[
              {
                label: 'Story tip or submission',
                body: 'Found a story you think we should cover? Send us the URL and a one-line note on why it matters.',
                email: 'tips@topnewsclips.com',
              },
              {
                label: 'Corrections',
                body: 'If something we published is wrong or misleading, we want to know. We take corrections seriously.',
                email: 'corrections@topnewsclips.com',
              },
              {
                label: 'Everything else',
                body: 'Feedback, partnerships, press inquiries, or anything else.',
                email: 'hello@topnewsclips.com',
              },
            ].map(({ label, body, email }) => (
              <div key={label} className="p-5 border border-white/10 bg-white/[0.03] rounded-lg">
                <p className="text-xs font-bold tracking-widest text-[oklch(0.52_0.14_196)] uppercase mb-1">{label}</p>
                <p className="text-sm text-white/65 mb-3">{body}</p>
                <a
                  href={`mailto:${email}`}
                  className="text-sm font-semibold text-white hover:underline underline-offset-2"
                >
                  {email}
                </a>
              </div>
            ))}
          </div>

        </div>
      </main>
      <Footer />
    </>
  )
}
