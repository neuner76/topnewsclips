import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your Referrals — Top News Clips',
  robots: { index: false },
}

const SITE_URL = 'https://www.topnewsclips.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  if (!code) {
    return (
      <>
        <Header />
        <main className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No referral code provided. Check your day-14 email for your personal link.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold underline underline-offset-2">
            Back to home
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  const supabase = getSupabase()

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('email, referral_code, created_at')
    .eq('referral_code', code.toUpperCase())
    .single()

  if (!subscriber) {
    return (
      <>
        <Header />
        <main className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Referral code not found.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold underline underline-offset-2">
            Back to home
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  const { count: referralCount } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', code.toUpperCase())

  const count = referralCount ?? 0
  const referralUrl = `${SITE_URL}?ref=${subscriber.referral_code}`
  const tweetText = encodeURIComponent(`I've been reading @TopNewsClips every morning — stories the mainstream media isn't covering, global events US outlets ignore, and a 5-minute briefing that keeps you informed.\n\n${referralUrl}`)
  const whatsappText = encodeURIComponent(`Stories mainstream media isn't covering — free daily briefing:\n${referralUrl}`)

  const milestones = [
    { threshold: 1,  label: 'First referral',   note: 'You\'re on the board.' },
    { threshold: 5,  label: '5 referrals',       note: 'You\'re building something.' },
    { threshold: 10, label: '10 referrals',      note: 'Seriously impressive.' },
    { threshold: 25, label: '25 referrals',       note: 'You\'re a TopNewsClips ambassador.' },
  ]
  const nextMilestone = milestones.find(m => count < m.threshold)

  return (
    <>
      <Header />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">

        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {' › '}Referrals
          </p>
          <h1 className="text-3xl font-black tracking-tight">Your Referrals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every person you refer gets the same free daily briefing. You help build something independent.
          </p>
        </div>

        {/* Count */}
        <div className="bg-[oklch(0.96_0.02_196)] border border-[oklch(0.88_0.06_196)] rounded-xl p-8 text-center mb-6">
          <p className="text-7xl font-black tabular-nums text-[oklch(0.45_0.14_196)]">{count}</p>
          <p className="text-base font-semibold text-foreground mt-2">
            {count === 1 ? 'person referred' : 'people referred'}
          </p>
          {nextMilestone && count < nextMilestone.threshold && (
            <p className="text-sm text-muted-foreground mt-3">
              {nextMilestone.threshold - count} more to reach <strong>{nextMilestone.label}</strong> — {nextMilestone.note}
            </p>
          )}
          {count >= 25 && (
            <p className="text-sm font-semibold text-[oklch(0.45_0.14_196)] mt-3">
              TopNewsClips ambassador. Thank you.
            </p>
          )}
        </div>

        {/* Referral link */}
        <div className="border border-border rounded-lg p-5 mb-6">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">Your referral link</p>
          <p className="text-sm font-mono bg-muted px-3 py-2 rounded border border-border break-all mb-4 select-all">
            {referralUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${tweetText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-2 rounded bg-black text-white hover:opacity-80 transition-opacity"
            >
              Share on X
            </a>
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-2 rounded bg-[#25d366] text-white hover:opacity-80 transition-opacity"
            >
              WhatsApp
            </a>
            <CopyButton url={referralUrl} />
          </div>
        </div>

        {/* Milestones */}
        <div className="border border-border rounded-lg divide-y divide-border">
          {milestones.map(m => (
            <div key={m.threshold} className="flex items-center gap-4 px-5 py-3">
              <span className={`text-xl ${count >= m.threshold ? 'grayscale-0' : 'grayscale opacity-30'}`}>
                {count >= m.threshold ? '✓' : '○'}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${count >= m.threshold ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {m.label}
                </p>
                <p className="text-xs text-muted-foreground">{m.note}</p>
              </div>
              <span className={`text-xs font-bold tabular-nums ${count >= m.threshold ? 'text-[oklch(0.45_0.14_196)]' : 'text-muted-foreground'}`}>
                {m.threshold}
              </span>
            </div>
          ))}
        </div>

      </main>
      <Footer />
    </>
  )
}

// Small client component just for the copy button
function CopyButton({ url }: { url: string }) {
  'use client'
  // Rendered server-side, hydrated client-side via inline script trick
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url)
        const btn = document.activeElement as HTMLButtonElement
        const orig = btn.textContent
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = orig }, 2000)
      }}
      className="text-xs font-semibold px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
    >
      Copy link
    </button>
  )
}
