import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DarkModeToggle from '@/components/DarkModeToggle'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="bg-foreground text-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-tight">TNC Admin</span>
            <nav className="flex items-center gap-4 text-xs font-medium text-background/70">
              <Link href="/admin" className="hover:text-background transition-colors">
                Dashboard
              </Link>
              <Link href="/admin/journalists" className="hover:text-background transition-colors">
                Journalists
              </Link>
              <Link href="/admin/digest" className="hover:text-background transition-colors">
                Digest
              </Link>
              <Link href="/admin/stories/new" className="hover:text-background transition-colors">
                + New Story
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <Link href="/" className="text-xs text-background/60 hover:text-background transition-colors">
              View site →
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button className="text-xs text-background/60 hover:text-background transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  )
}
