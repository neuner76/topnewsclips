import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { getLatestDigest } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { buildEmailHtml, buildStoryMap, formatDate } from '@/lib/email/digest-html'

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const digest = await getLatestDigest()
  if (!digest) {
    return new NextResponse('No digest found', { status: 404 })
  }

  const supabase = getServiceSupabase()
  const storyMap = await buildStoryMap(
    async (slugs) => { const { data } = await supabase.from('stories').select('*').in('slug', slugs); return (data ?? []) as Story[] },
    digest.content
  )
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topnewsclips.com'

  const sendTo = request.nextUrl.searchParams.get('sendTo')

  if (sendTo) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return new NextResponse('RESEND_API_KEY not set', { status: 500 })

    const resend = new Resend(resendKey)
    const html = buildEmailHtml(digest.content, digest.date, siteUrl, storyMap)
      .replace('{{preferences}}', `${siteUrl}/preferences/preview`)
      .replace('{{unsubscribe}}', `${siteUrl}/api/unsubscribe?token=preview`)

    await resend.emails.send({
      from: 'TopNewsClips <digest@topnewsclips.com>',
      to: sendTo,
      subject: `[PREVIEW] Your briefing — ${formatDate(digest.date)}`,
      html,
    })

    return NextResponse.json({ sent: true, to: sendTo, date: digest.date })
  }

  // Browser preview — return raw HTML
  const html = buildEmailHtml(digest.content, digest.date, siteUrl, storyMap)
    .replace('{{preferences}}', `${siteUrl}/preferences/preview`)
    .replace('{{unsubscribe}}', `${siteUrl}/api/unsubscribe?token=preview`)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
