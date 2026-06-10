import Link from 'next/link'

export default function UnsubscribedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#0a0f1e] text-white">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3 text-[#3b82f6]">
          Top News Clips
        </p>
        <h1 className="text-3xl font-black tracking-tight mb-3 text-white">You&apos;re unsubscribed.</h1>
        <p className="text-white/65 text-sm leading-relaxed mb-7">
          You won&apos;t receive any more emails from TopNewsClips. You can resubscribe any time.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-[#3b82f6] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Back to TopNewsClips
        </Link>
      </div>
    </main>
  )
}
