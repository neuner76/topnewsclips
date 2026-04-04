import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAnonClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const TIER_SOURCE_TYPES: Record<number, string> = {
  1: 'Nonprofit Investigative',
  2: 'OSINT',
  3: 'Public Broadcaster',
  4: 'Independent News',
  5: 'Wire Service',
  6: 'Commercial / Explainer',
  7: 'Independent Commentary',
  8: 'State Media',
  9: 'Raw Footage',
  10: 'Community Sourced',
}

/**
 * Parse a YouTube or TikTok channel URL into { username, platform }.
 * Returns null if the URL format isn't recognised.
 *
 * Handles:
 *   https://www.youtube.com/@Handle
 *   https://youtube.com/@Handle
 *   https://www.tiktok.com/@Handle
 */
function parseChannelUrl(url: string): { username: string; platform: 'youtube' | 'tiktok' } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtube.com') {
      // /@Handle or /c/Handle or /user/Handle — we only auto-add @Handle format
      const m = u.pathname.match(/^\/@([\w.-]+)/i)
      if (!m) return null
      return { username: m[1], platform: 'youtube' }
    }

    if (host === 'tiktok.com') {
      const m = u.pathname.match(/^\/@([\w.]+)/i)
      if (!m) return null
      return { username: m[1], platform: 'tiktok' }
    }

    return null
  } catch {
    return null
  }
}

export async function PATCH(req: NextRequest) {
  // Auth check uses the anon/cookie client — verifies the session
  const anonClient = await createAnonClient()
  const { data: { user } } = await anonClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All DB writes use the service role to bypass RLS
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { id, status, decision_tier, decision_rationale, submitter_email } = await req.json()

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Submission ID required.' }, { status: 400 })
  }

  const validStatuses = ['submitted', 'under_review', 'accepted', 'declined']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const isDecision = status === 'accepted' || status === 'declined'

  const update: Record<string, unknown> = { status }
  if (isDecision) {
    update.reviewed_at = new Date().toISOString()
    update.decision_rationale = decision_rationale ?? null
    update.decision_tier = decision_tier ?? null
    if (status === 'accepted') {
      update.is_community_nominated = true
      update.community_nominated_at = new Date().toISOString()
    }
  } else if (decision_rationale) {
    update.decision_rationale = decision_rationale
  }

  const { error } = await supabase
    .from('source_submissions')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // On acceptance: automatically add the source to featured_journalists
  if (status === 'accepted') {
    try {
      const { data: sub } = await supabase
        .from('source_submissions')
        .select('channel_url, decision_tier')
        .eq('id', id)
        .single()

      if (sub?.channel_url) {
        const parsed = parseChannelUrl(sub.channel_url)

        if (parsed) {
          const tierNum: number | null = sub.decision_tier ?? decision_tier ?? null
          const sourceType = tierNum ? (TIER_SOURCE_TYPES[tierNum] ?? null) : null

          // Upsert — idempotent if the source was already manually added
          await supabase.from('featured_journalists').upsert(
            {
              username: parsed.username,
              platform: parsed.platform,
              active: true,
              source_tier: tierNum,
              source_type: sourceType,
            },
            { onConflict: 'username,platform', ignoreDuplicates: false }
          )
        }
      }
    } catch {
      // Non-fatal — the submission status was already saved successfully
    }

    // Notify submitter if they left an email
    if (submitter_email && typeof submitter_email === 'string') {
      try {
        const { data: sub } = await supabase
          .from('source_submissions')
          .select('channel_url, decision_tier')
          .eq('id', id)
          .single()

        if (sub) {
          const resendKey = process.env.RESEND_API_KEY
          if (resendKey) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Top News Clips <hello@topnewsclips.com>',
                to: submitter_email,
                subject: 'Your source recommendation was accepted',
                text: `Good news — the source you recommended (${sub.channel_url}) has been accepted into the Top News Clips library as a Tier ${sub.decision_tier ?? '?'} source.\n\nYou can see it in the review log at https://www.topnewsclips.com/recommend-a-source\n\nThanks for helping build the source library.\n\n— Top News Clips`,
              }),
            })
          }
        }
      } catch {
        // Non-fatal
      }
    }
  }

  return NextResponse.json({ ok: true })
}
