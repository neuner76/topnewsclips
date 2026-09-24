import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildMyLocalDigest, type MyLocalDigest } from '@/lib/local/digest'
import { LocalDigestView } from './LocalDigestView'

// Owner-gated, dynamic (reads the admin session). Renders only real, live data;
// sections without a live source yet are shown as "coming soon", never faked.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Local — TopNewsClips' }

export default async function LocalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let digest: MyLocalDigest
  try {
    digest = await buildMyLocalDigest()
  } catch {
    return <main className="mx-auto max-w-2xl px-4 py-10"><p className="text-sm text-red-600">My Local is temporarily unavailable.</p></main>
  }

  return <LocalDigestView digest={digest} heading="My Local" subheading="What changed around you — from your block to your county." />
}
