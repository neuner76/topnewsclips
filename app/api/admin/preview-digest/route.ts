import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getLatestDigest } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { buildEmailHtml, buildStoryMap, formatDate } from '@/lib/email/digest-html'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const digest = await getLatestDigest()
  if (!digest) {
    return new NextResponse('No digest found', { status: 404 })
  }

  const supabase = getSupabase()
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
      .replace('{{email}}', encodeURIComponent(sendTo))

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
    .replace('{{email}}', encodeURIComponent('preview@example.com'))

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
