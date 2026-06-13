import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getLatestDigest, type DigestContent } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { buildEmailHtml, buildStoryMap, feedUrlUtm, formatDate, storyUrl } from '@/lib/email/digest-html'
import { unsubscribeLink } from '@/lib/unsubscribe'
import { preferenceLink } from '@/lib/preference-tokens'
import { getPersonalizationProfile, personalizeDigestContent } from '@/lib/personalized-digest'
import { requireCronSecret } from '@/lib/auth'
import { selectNewsletterNextStep } from '@/lib/newsletter-next-step'
import { buildDigestEdition, formatDigestMetadata, validateDigestEdition } from '@/lib/digest-canonical'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function buildEmailText(content: DigestContent, date: string, siteUrl: string, storyMap: Map<string, Story>): string {
  const edition = buildDigestEdition({ id: `text-${date}`, date, content, generated_at: '' }, storyMap, siteUrl)
  const validation = validateDigestEdition(edition)
  if (validation.errors.length > 0 || validation.warnings.length > 0) {
    console.warn('[digest-email-text] canonical digest validation', validation)
  }

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
  for (const section of edition.sections.filter(section => section.name !== 'Also Worth Knowing')) {
    if (section.items.length === 0) continue
    lines.push(section.name.toUpperCase())
    for (const item of section.items) {
      const link = item.url ? ` ${storyUrl(siteUrl, item.id)}` : ''
      lines.push(`• ${item.summary}${link}`)
      const meta = formatDigestMetadata(item.metadata, { includeTier: true, includeCaution: true })
      if (meta) lines.push(`  ${meta}`)
    }
    if (section.omittedCount) lines.push(`More in the full archive: ${siteUrl}/stories`)
    lines.push('')
  }

  const alsoWorthKnowing = edition.sections.find(section => section.name === 'Also Worth Knowing')
  if (alsoWorthKnowing && alsoWorthKnowing.items.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('ALSO WORTH KNOWING')
    lines.push('')
    for (const item of alsoWorthKnowing.items) {
      const link = item.url ? `  ${storyUrl(siteUrl, item.id)}` : ''
      lines.push(`• ${item.summary}${link}`)
      const meta = formatDigestMetadata(item.metadata, { includeCaution: true })
      if (meta) lines.push(`  ${meta}`)
    }
    if (alsoWorthKnowing.omittedCount) lines.push(`More in the full archive: ${siteUrl}/stories`)
    lines.push('')
  }

  const nextStep = selectNewsletterNextStep(content, storyMap, siteUrl)
  if (nextStep) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push(nextStep.heading.toUpperCase())
    lines.push(`${nextStep.label}: ${nextStep.description}`)
    lines.push(`Why this step: ${nextStep.why}`)
    lines.push(nextStep.url)
    lines.push('')
  }

  // Mainstream Pulse
  if (content.mainstreamPulse && content.mainstreamPulse.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('MAINSTREAM PULSE')
    lines.push("What the major outlets are leading with today.")
    if (edition.mainstreamPulse?.synthesis) lines.push(edition.mainstreamPulse.synthesis)
    lines.push('')
    for (const item of content.mainstreamPulse) {
      const link = item.slug ? ` — ${storyUrl(siteUrl, item.slug)}` : item.url ? ` — ${item.url}` : ''
      lines.push(`[${item.source.toUpperCase()} · ${item.descriptor}] ${item.headline}${link}`)
    }
    lines.push('')
  }

  // Global Blindspot
  if (edition.globalBlindspot.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('🌍 GLOBAL BLINDSPOT')
    lines.push('Stories the rest of the world is covering that US media is ignoring.')
    lines.push('')
    for (const item of edition.globalBlindspot) {
      const meta = formatDigestMetadata(item.metadata, { includeHandle: true, includeCaution: true })
      lines.push(item.title)
      if (meta) lines.push(meta)
      lines.push(item.summary)
      lines.push(`Full story: ${storyUrl(siteUrl, item.id)}`)
      lines.push('')
    }
  }

  // Global Lens
  if (edition.globalLens.length > 0) {
    lines.push('─'.repeat(60))
    lines.push('')
    lines.push('🌍 GLOBAL LENS')
    lines.push("How international outlets are covering today's stories — perspectives US media isn't amplifying.")
    lines.push('')
    for (const item of edition.globalLens) {
      const meta = formatDigestMetadata(item.metadata, { includeHandle: true, includeCaution: true })
      lines.push(item.title)
      if (meta) lines.push(meta)
      lines.push(item.summary)
      lines.push(`Full story: ${storyUrl(siteUrl, item.id)}`)
      lines.push('')
    }
  }

  lines.push('━'.repeat(60))
  lines.push(`${feedUrlUtm(siteUrl)}`)
  lines.push('You\'re receiving this because you subscribed at topnewsclips.com.')
  lines.push('Tune your briefing: {{preferences}}')
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
    .select('id, email, unsubscribe_token')

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

  const subject = `Your briefing — ${formatDate(digest.date)}`

  // Resend supports batch send up to 100 emails per request
  // Each email gets personalized account links.
  const BATCH_SIZE = 100
  let sent = 0
  const errors: string[] = []

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE)
    try {
      const emails = await Promise.all(
        batch.map(async (subscriber: { id: string; email: string; unsubscribe_token: string }) => {
          const profile = await getPersonalizationProfile(supabase, subscriber.id)
          const personalizedContent = await personalizeDigestContent(supabase, digest.content, profile)
          const html = buildEmailHtml(personalizedContent, digest.date, siteUrl, storyMap)
          const text = buildEmailText(personalizedContent, digest.date, siteUrl, storyMap)
          const unsubUrl = unsubscribeLink(siteUrl, subscriber.unsubscribe_token)
          const prefsUrl = preferenceLink(siteUrl, subscriber.id)
          return {
            from: 'TopNewsClips <digest@topnewsclips.com>',
            to: subscriber.email,
            subject,
            html: html.replace('{{preferences}}', prefsUrl).replace('{{unsubscribe}}', unsubUrl),
            text: text.replace('{{preferences}}', prefsUrl).replace('{{unsubscribe}}', unsubUrl),
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        })
      )
      await resend.batch.send(
        emails
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
