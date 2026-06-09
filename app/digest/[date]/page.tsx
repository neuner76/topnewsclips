import { getDigestByDate } from '@/lib/digest'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import EmailCapture from '@/components/EmailCapture'
import Link from 'next/link'
import { DigestDisplay } from '@/components/DigestDisplay'
import { notFound } from 'next/navigation'

export const revalidate = 3600

type Props = { params: Promise<{ date: string }> }

export default async function DigestByDatePage({ params }: Props) {
  const { date } = await params
  const digest = await getDigestByDate(date)

  if (!digest) notFound()

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <Link
            href="/newsletter"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All editions
          </Link>
        </div>
        <DigestDisplay content={digest.content} date={digest.date} />
        <EmailCapture />
      </main>
      <Footer />
    </>
  )
}
