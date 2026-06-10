import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getLatestDigest, type DigestContent } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { buildEmailHtml, buildStoryMap, formatDate, storyUrl, siteUrlUtm } from '@/lib/email/digest-html'
import { unsubscribeLink } from '@/lib/unsubscribe'
import { requireCronSecret } from '@/lib/auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Split at the first sentence boundary, skipping periods inside abbreviations like "U.S." or "Dr."
function firstSentence(text: string): string {
  const match = text.match(/^.*?(?<!\b[A-Z])\.(?=\s+[A-Z]|$)/)
  return match ? match[0] : text
}

function buildEmailText(content: DigestContent, date: string, siteUrl: string): string {
  const inTheKnowCategories = [
    'Politics & World Affairs',
    'Science & Technology',
    'Business & Markets',
    'Sports, Entertainment, & Culture',
    'Comedy & Satire',
  ] as const

  const lines: string[] = []

  lines.push(`TOPNEWSCLIPS — ${formatDate(date)}`)
  lines.push('The full picture, not the profitable picture.')
  lines.push('')
  lines.push('━'.repeat(60))
  lines.push('')

  // Need to Know
  for (const item of content.needToKnow) {
    lines.push('NEED TO KNOW')
    lines.push(item.sectionTitle.toUpperCase())
    lines.push('')
    for (const p of item.paragraphs.slice(0, 2)) {
      lines.push(p)
      lines.push('')
    }
    if (item.howWorldSeesIt && item.howWorldSeesIt.length > 0) {
      lines.push('HOW THE WORLD SEES IT')
      for (const w of item.howWorldSeesIt) {
        lines.push(`[${w.region.toUpperCase()}] ${w.summary}  ${storyUrl(siteUrl, w.slug)}`)
      }
      lines.push('')
    }
    lines.push(`Watch: ${storyUrl(siteUrl, item.slug)}`)
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('')
  }

  // In the Know
  lines.push('IN THE KNOW')
  lines.push('')
  for (const cat of inTheKnowCategories) {
    const items = content.inTheKnow[cat]
    if (!items || items.length === 0) continue
    lines.push(cat.toUpperCase())
    for (const item of items) {
      const link = item.slug ? ` ${storyUrl(siteUrl, item.slug)}` : ''
      lines.push(`• ${item.text}${link}`)
    }
    lines.push('')
  }

  // Also worth knowing
  if (content.etcetera.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('ALSO WORTH KNOWING')
    lines.push('')
    for (const item of content.etcetera) {
      const etc = typeof item === 'string' ? { text: item, slug: null } : item
      const link = etc.slug ? `  ${storyUrl(siteUrl, etc.slug)}` : ''
      lines.push(`• ${etc.text}${link}`)
    }
    lines.push('')
  }

  // Mainstream Pulse
  if (content.mainstreamPulse && content.mainstreamPulse.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('MAINSTREAM PULSE')
    lines.push("What the major outlets are leading with today.")
    lines.push('')
    for (const item of content.mainstreamPulse) {
      lines.push(`[${item.source.toUpperCase()} · ${item.descriptor}] ${item.headline}`)
    }
    lines.push('')
  }

  // Global Blindspot
  if (content.globalBlindspots && content.globalBlindspots.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('🌍 GLOBAL BLINDSPOT')
    lines.push('Stories the rest of the world is covering that US media is ignoring.')
    lines.push('')
    for (const item of content.globalBlindspots) {
      const sentence = firstSentence(item.summary)
      lines.push(`[${item.region.toUpperCase()}] ${item.title}`)
      lines.push(sentence)
      lines.push(`Watch: ${storyUrl(siteUrl, item.slug)}`)
      lines.push('')
    }
  }

  // Global Lens
  if (content.globalLens && content.globalLens.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('🌍 GLOBAL LENS')
    lines.push("How international outlets are covering today's stories — perspectives US media isn't amplifying.")
    lines.push('')
    for (const item of content.globalLens) {
      const sentence = firstSentence(item.summary)
      lines.push(`[${item.region.toUpperCase()}] ${item.title}`)
      lines.push(sentence)
      lines.push(`Watch: ${storyUrl(siteUrl, item.slug)}`)
      lines.push('')
    }
  }

  lines.push('━'.repeat(60))
  lines.push(`${siteUrlUtm(siteUrl)}`)
  lines.push('You\'re receiving this because you subscribed at topnewsclips.com.')
  lines.push('Unsubscribe: {{unsubscribe}}')

  return lines.join('\n')
}

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const digest = await getLatestDigest()
  if (!digest) {
    return NextResponse.json({ error: 'No digest found' }, { status: 404 })
  }

  // Only send today's digest (anchored to ET, same as digest date)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (digest.date !== today) {
    return NextResponse.json({ error: `Digest is from ${digest.date}, not today (${today})` }, { status: 400 })
  }

  const supabase = getSupabase()

  // Guard: only send once per day — check if email was already sent for today's digest
  const { data: sentCheck } = await supabase
    .from('digests')
    .select('email_sent_at')
    .eq('id', digest.id)
    .single()

  if (sentCheck?.email_sent_at) {
    return NextResponse.json({ skipped: true, message: `Email already sent at ${sentCheck.email_sent_at}` })
  }
  const { data: subscribers, error } = await supabase
    .from('subscribers')
    .select('email, unsubscribe_token')

  if (error) {
    return NextResponse.json({ error: `Failed to fetch subscribers: ${error.message}` }, { status: 500 })
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No subscribers' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topnewsclips.com'
  const resend = new Resend(resendKey)

  const storyMap = await buildStoryMap(
    async (slugs) => { const { data } = await supabase.from('stories').select('*').in('slug', slugs); return (data ?? []) as Story[] },
    digest.content
  )

  const baseHtml = buildEmailHtml(digest.content, digest.date, siteUrl, storyMap)
  const baseText = buildEmailText(digest.content, digest.date, siteUrl)
  const subject = `Your briefing — ${formatDate(digest.date)}`

  // Resend supports batch send up to 100 emails per request
  // Each email gets a personalized unsubscribe link
  const BATCH_SIZE = 100
  let sent = 0
  const errors: string[] = []

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE)
    try {
      await resend.batch.send(
        batch.map((subscriber: { email: string; unsubscribe_token: string }) => {
          const unsubUrl = unsubscribeLink(siteUrl, subscriber.unsubscribe_token)
          return {
            from: 'TopNewsClips <digest@topnewsclips.com>',
            to: subscriber.email,
            subject,
            html: baseHtml.replace('{{unsubscribe}}', unsubUrl),
            text: baseText.replace('{{unsubscribe}}', unsubUrl),
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        })
      )
      sent += batch.length
    } catch (err) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (sent > 0) {
    await supabase.from('digests').update({ email_sent_at: new Date().toISOString() }).eq('id', digest.id)
  }

  return NextResponse.json({ sent, total: subscribers.length, errors })
}
