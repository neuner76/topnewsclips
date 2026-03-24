import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md">
        <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
          Story Not Found
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-4">
          This clip has expired.
        </h1>
        <p className="text-[15px] leading-relaxed text-foreground/80 mb-3">
          TopNewsClips refreshes daily — stories cycle out after 7 days to keep the feed current and relevant. If you followed a link from an older newsletter, the clip is no longer available.
        </p>
        <p className="text-[15px] leading-relaxed text-foreground/80 mb-8">
          Head to the homepage to see what&apos;s breaking today.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="inline-block text-sm font-semibold bg-foreground text-background px-4 py-2 rounded hover:opacity-90 transition-opacity text-center"
          >
            Today&apos;s Digest
          </Link>
          <Link
            href="/?view=clips"
            className="inline-block text-sm font-semibold border border-border px-4 py-2 rounded hover:bg-muted transition-colors text-center"
          >
            Today&apos;s Clips
          </Link>
        </div>
      </div>
    </main>
  )
}
