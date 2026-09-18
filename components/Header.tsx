import Link from 'next/link'
import MobileMenu from './MobileMenu'

export default function Header() {
  return (
    <header className="border-b border-[#E2E8F0] bg-background sticky top-0 z-50" style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.85)' }}>
      <div className="max-w-5xl mx-auto pl-2 pr-3 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo → landing page */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-black text-sm sm:text-xl tracking-tight text-[#0F172A]">
              TOP NEWS CLIPS
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-5 text-sm font-medium">
            <Link href="/feed" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Today&apos;s Digest
            </Link>
            <Link href="/clips" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Clips
            </Link>
            <Link href="/stories" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Archive
            </Link>
            <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              About
            </Link>
            <Link
              href="/search"
              aria-label="Search"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Link>
            <MobileMenu />
          </nav>

        </div>
      </div>
    </header>
  )
}
