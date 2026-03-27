import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm tracking-tight">TOP NEWS CLIPS</p>
            <p className="text-xs text-muted-foreground mt-1">
              What mainstream media misses. What the world is watching. In 5 minutes.
            </p>
          </div>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/stories" className="hover:text-foreground transition-colors">
              Archive
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/taxonomy" className="hover:text-foreground transition-colors">
              Sources
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/rss.xml" className="hover:text-foreground transition-colors">
              RSS
            </Link>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground mt-8">
          © {new Date().getFullYear()} Top News Clips. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
