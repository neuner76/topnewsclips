import Link from 'next/link'

export default function UnsubscribedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-3">You&apos;re unsubscribed.</h1>
        <p className="text-muted-foreground text-sm mb-6">
          You won&apos;t receive any more emails from TopNewsClips. You can resubscribe any time.
        </p>
        <Link href="/" className="text-sm font-semibold underline underline-offset-4">
          Back to TopNewsClips
        </Link>
      </div>
    </main>
  )
}
