import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b-2 border-[oklch(0.52_0.14_196)] bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-bold text-xl tracking-tight text-foreground">
              TOP NEWS CLIPS
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Digest
            </Link>
            <Link href="/?view=clips" className="hover:text-foreground transition-colors">
              Clips
            </Link>
            <Link href="/stories" className="hover:text-foreground transition-colors hidden sm:block">
              Archive
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors hidden sm:block">
              About
            </Link>
            <Link
              href="/search"
              aria-label="Search"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Link>
            <Link
              href="/#subscribe"
              className="bg-[oklch(0.52_0.14_196)] text-white px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
            >
              Subscribe
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
