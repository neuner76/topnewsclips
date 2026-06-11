import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecretOrAdminSession } from '@/lib/auth'
import { preferenceLink } from '@/lib/preference-tokens'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Missing email query parameter.' }, { status: 400 })
  }

  const { data: subscriber, error } = await getSupabase()
    .from('subscribers')
    .select('id, email')
    .eq('email', email)
    .single()

  if (error || !subscriber) {
    return NextResponse.json({ error: `Subscriber not found: ${email}` }, { status: 404 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topnewsclips.com'
  return NextResponse.json({
    email: subscriber.email,
    preferenceUrl: preferenceLink(siteUrl, subscriber.id),
  })
}
