import { getLatestDigest } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'
import { DigestDisplay } from '@/components/DigestDisplay'

export const revalidate = 300

export default async function DigestPage() {
  const digest = await getLatestDigest()

  if (!digest) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No digest yet — check back soon.</p>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <DigestDisplay content={digest.content} date={digest.date} />
        <EmailCapture />
        <div className="mt-4 pt-6 border-t border-border text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to all clips
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
