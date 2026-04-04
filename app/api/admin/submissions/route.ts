import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  // Auth check — must be a logged-in admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    // Allow saving a draft rationale on under_review too
    update.decision_rationale = decision_rationale
  }

  const { error } = await supabase
    .from('source_submissions')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If accepted and submitter left an email, notify them
  // (best-effort — no hard failure if this errors)
  if (status === 'accepted' && submitter_email && typeof submitter_email === 'string') {
    try {
      // Fetch the submission URL for the notification
      const { data: sub } = await supabase
        .from('source_submissions')
        .select('channel_url, decision_tier')
        .eq('id', id)
        .single()

      if (sub) {
        // Fire-and-forget: reuse existing Resend setup if available
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

  return NextResponse.json({ ok: true })
}
