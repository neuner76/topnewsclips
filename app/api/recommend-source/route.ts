import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isValidUrl(s: string): boolean {
  try {
    const url = new URL(s)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { channel_url, reason, suggested_tier, submitter_email } = body as Record<string, unknown>

  if (typeof channel_url !== 'string' || !channel_url.trim()) {
    return NextResponse.json({ error: 'Channel URL is required.' }, { status: 400 })
  }
  if (!isValidUrl(channel_url.trim())) {
    return NextResponse.json({ error: 'Please enter a valid URL.' }, { status: 400 })
  }
  if (typeof reason !== 'string' || reason.trim().length < 10) {
    return NextResponse.json({ error: 'Please explain why this source belongs (at least 10 characters).' }, { status: 400 })
  }
  if (reason.trim().length > 500) {
    return NextResponse.json({ error: 'Reason must be 500 characters or fewer.' }, { status: 400 })
  }

  const tierValue = suggested_tier !== undefined && suggested_tier !== '' && suggested_tier !== null
    ? Number(suggested_tier)
    : null
  if (tierValue !== null && (isNaN(tierValue) || tierValue < 1 || tierValue > 10)) {
    return NextResponse.json({ error: 'Suggested tier must be between 1 and 10.' }, { status: 400 })
  }

  const emailValue = typeof submitter_email === 'string' && submitter_email.includes('@')
    ? submitter_email.toLowerCase().trim()
    : null

  const supabase = await createClient()

  // Rate-limit by URL: reject if this exact URL was already submitted in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('source_submissions')
    .select('id')
    .eq('channel_url', channel_url.trim())
    .gte('created_at', thirtyDaysAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'This channel was already submitted recently. Check the review log below for its status.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('source_submissions').insert({
    channel_url: channel_url.trim(),
    reason: reason.trim(),
    suggested_tier: tierValue,
    submitter_email: emailValue,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Submitted.' })
}
