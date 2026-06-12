import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm tracking-tight">TOP NEWS CLIPS</p>
            <p className="text-xs text-muted-foreground mt-1">
              The full picture, not the profitable picture.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/search" className="hover:text-foreground transition-colors">
              Search
            </Link>
            <Link href="/stories" className="hover:text-foreground transition-colors">
              Archive
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="/trust" className="hover:text-foreground transition-colors">
              Trust
            </Link>
            <Link href="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            <Link href="/taxonomy" className="hover:text-foreground transition-colors">
              Sources
            </Link>
            <Link href="/response-taxonomy" className="hover:text-foreground transition-colors">
              Response Taxonomy
            </Link>
            <Link href="/recommend-a-source" className="hover:text-foreground transition-colors">
              Recommend a Source
            </Link>
            <Link href="/corrections" className="hover:text-foreground transition-colors">
              Corrections
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
