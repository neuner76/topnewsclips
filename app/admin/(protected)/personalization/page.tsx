import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { preferenceLink } from '@/lib/preference-tokens'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdminPersonalizationPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams
  const email = params.email?.trim().toLowerCase() ?? ''
  let preferenceUrl: string | null = null
  let error: string | null = null

  if (email) {
    const { data: subscriber, error: subscriberError } = await getSupabase()
      .from('subscribers')
      .select('id, email')
      .eq('email', email)
      .single()

    if (subscriberError || !subscriber) {
      error = `Subscriber not found: ${email}`
    } else {
      const siteUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topnewsclips.com')
      preferenceUrl = preferenceLink(siteUrl, subscriber.id)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Personalization QA</p>
        <h1 className="mt-1 text-2xl font-bold">Generate a preference link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use this to test a subscriber&apos;s preference page without sending a live digest.
        </p>
      </div>

      <form className="rounded-lg border bg-card p-4">
        <label htmlFor="email" className="text-sm font-semibold">Subscriber email</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            placeholder="neuner@gmail.com"
            className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Generate link
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {preferenceUrl && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold">Preference URL</p>
          <Link
            href={preferenceUrl}
            className="mt-2 block break-all text-sm text-blue-600 underline"
          >
            {preferenceUrl}
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Open this link, save a few topics and custom interests, then confirm rows appear in Supabase.
          </p>
        </div>
      )}
    </div>
  )
}
