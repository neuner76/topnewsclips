import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { readHeldEvents, type HeldEventView } from '@/lib/local/review'
import { ReviewList } from './ReviewList'

// Owner-gated review queue: held events (event types with auto_publish=false, plus
// anything held by the §10 gate) awaiting a publish/reject decision. Dynamic —
// reads the admin session and the live store.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Local — Review queue' }

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  let held: HeldEventView[] = []
  let error: string | null = null
  try {
    held = await readHeldEvents(serviceClient())
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load the review queue.'
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Held events awaiting a decision. Publishing makes an event eligible for the store-backed feed; rejecting removes it from consideration.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && held.length === 0 && (
          <p className="rounded-lg border border-[#EFF2F6] bg-[#FAFBFC] px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing to review — no held events right now.
          </p>
        )}
        {!error && held.length > 0 && <ReviewList initial={held} />}
      </main>
      <Footer />
    </>
  )
}
