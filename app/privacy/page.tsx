import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Top News Clips',
  description: 'How Top News Clips collects, uses, and protects your information. We collect only your email address and never sell your data.',
  alternates: { canonical: 'https://www.topnewsclips.com/privacy' },
  openGraph: {
    title: 'Privacy Policy | Top News Clips',
    description: 'How Top News Clips collects, uses, and protects your information.',
    url: 'https://www.topnewsclips.com/privacy',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Top News Clips',
    description: 'How Top News Clips collects, uses, and protects your information.',
    site: '@topnewsclips',
  },
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}Privacy
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">What we collect</h2>
            <p>
              When you subscribe to the TopNewsClips daily briefing, we collect your email address.
              That&apos;s it. We do not collect names, phone numbers, payment information, or any
              other personal data.
            </p>
            <p className="mt-3">
              We use Vercel Analytics to understand how the site is used, pageviews, traffic sources,
              and device types. This data is aggregated and anonymous. No cookies are set for
              analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">How we use your email</h2>
            <p>
              We use your email address solely to send you the TopNewsClips daily briefing and
              occasional product updates. We will never sell, rent, or share your email with
              third parties for marketing purposes.
            </p>
            <p className="mt-3">
              Emails are sent via <a href="https://resend.com" className="underline underline-offset-2">Resend</a>.
              Your email address is stored securely in our database.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Unsubscribing</h2>
            <p>
              Every email we send includes an unsubscribe link. Click it and you will be immediately
              removed from the list. You can also email us directly to request removal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Third-party services</h2>
            <p>We use the following services to operate the site:</p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                { name: 'Vercel', purpose: 'Hosting and anonymous analytics' },
                { name: 'Supabase', purpose: 'Database (stores email addresses)' },
                { name: 'Resend', purpose: 'Email delivery' },
              ].map(({ name, purpose }) => (
                <li key={name} className="flex gap-2">
                  <span className="text-[oklch(0.52_0.14_196)] shrink-0">›</span>
                  <span><strong>{name}</strong>, {purpose}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black tracking-tight uppercase mb-3">Contact</h2>
            <p>
              Questions about this policy?{' '}
              <Link href="/contact" className="underline underline-offset-2">Contact us</Link>.
            </p>
          </section>

        </div>
      </main>
      <Footer />
    </>
  )
}
