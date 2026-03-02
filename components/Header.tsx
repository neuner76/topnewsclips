import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-bold text-xl tracking-tight text-foreground">
              TOP NEWS CLIPS
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Today
            </Link>
            <Link href="/archive" className="hover:text-foreground transition-colors">
              Archive
            </Link>
            <Link
              href="/#subscribe"
              className="bg-foreground text-background px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
            >
              Subscribe
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
