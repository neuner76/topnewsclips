import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getLatestDigest, type DigestContent } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const DIGEST_UTM = 'utm_source=email&utm_medium=email&utm_campaign=digest'

// Split at the first sentence boundary, skipping periods inside abbreviations like "U.S." or "Dr."
function firstSentence(text: string): string {
  const match = text.match(/^.*?(?<!\b[A-Z])\.(?=\s+[A-Z]|$)/)
  return match ? match[0] : text
}
function storyUrl(siteUrl: string, slug: string) { return `${siteUrl}/story/${slug}?${DIGEST_UTM}` }
function siteUrlUtm(siteUrl: string) { return `${siteUrl}?${DIGEST_UTM}` }

// ─── Email-safe badge helpers (inline styles only, no Tailwind/OKLCH) ────────

const TIER_COLORS: Record<number, { text: string; bg: string; border: string }> = {
  1:  { text: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  2:  { text: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  3:  { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  4:  { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  5:  { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  6:  { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  7:  { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  8:  { text: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  9:  { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  10: { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

const CONFIDENCE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  CORROBORATED:   { text: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  REPORTED:       { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  DEVELOPING:     { text: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  'SINGLE-SOURCE':{ text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  ANALYSIS:       { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

const CONFIDENCE_LABELS: Record<string, string> = {
  CORROBORATED: 'Corroborated',
  REPORTED: 'Reported',
  DEVELOPING: 'Developing',
  'SINGLE-SOURCE': 'Single-source',
  ANALYSIS: 'Analysis',
}

function badge(text: string, colors: { text: string; bg: string; border: string }, italic = false) {
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.05em;padding:1px 6px;border-radius:4px;border:1px solid ${colors.border};background:${colors.bg};color:${colors.text};${italic ? 'font-style:italic;' : ''}">${text}</span>`
}

function renderSourceBadge(story: Story): string {
  const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
  if (!tier || !sourceType) {
    return badge('Unclassified', { text: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' })
  }
  const colors = TIER_COLORS[tier] ?? TIER_COLORS[10]
  const label = tier === 8 ? `⚠ ${sourceType}` : sourceType
  return badge(label, colors)
}

function renderConfidenceBadge(story: Story): string {
  const label = getConfidenceLabel(story)
  const colors = CONFIDENCE_COLORS[label] ?? CONFIDENCE_COLORS['SINGLE-SOURCE']
  return badge(CONFIDENCE_LABELS[label] ?? label, colors, label === 'ANALYSIS')
}

function renderMsmBadge(story: Story): string {
  const covered = story.msm_outlet_coverage?.covered?.length ?? null
  const total = story.msm_outlet_coverage
    ? (story.msm_outlet_coverage.covered.length + story.msm_outlet_coverage.notCovered.length)
    : 15
  const label = covered !== null ? `⚠ ${covered} of ${total} outlets` : '⚠ Limited Coverage'
  return badge(label, { text: '#b45309', bg: '#fef9c3', border: '#fde68a' })
}

function renderBadgeRow(story: Story): string {
  const parts: string[] = []
  parts.push(renderSourceBadge(story))
  parts.push(renderConfidenceBadge(story))
  if (story.msm_gap) parts.push(renderMsmBadge(story))
  if (story.journalist_username) {
    parts.push(`<span style="font-size:10px;color:#9ca3af;">@${story.journalist_username}</span>`)
  }
  return `<div style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">${parts.join('')}</div>`
}

// ─────────────────────────────────────────────────────────────────────────────

function buildEmailHtml(content: DigestContent, date: string, siteUrl: string, storyMap: Map<string, Story>): string {
  const inTheKnowCategories = [
    'Politics & World Affairs',
    'Science & Technology',
    'Business & Markets',
    'Sports, Entertainment, & Culture',
    'Comedy & Satire',
  ] as const

  const needToKnowHtml = content.needToKnow.map(item => {
    const story = storyMap.get(item.slug)
    return `
    <div style="margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid #e5e7eb;">
      ${story ? renderBadgeRow(story) : ''}
      <a href="${storyUrl(siteUrl, item.slug)}" style="text-decoration:none;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#0e7490;text-transform:uppercase;margin-bottom:4px;">NEED TO KNOW</div>
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${item.sectionTitle}</h2>
      </a>
      ${item.paragraphs.slice(0, 2).map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#374151;">${p}</p>`).join('')}
      ${item.howWorldSeesIt && item.howWorldSeesIt.length > 0 ? `
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">How the world sees it</div>
          ${item.howWorldSeesIt.map(w => `
            <div style="display:flex;gap:12px;margin-bottom:6px;">
              <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;flex-shrink:0;width:72px;">${w.region}</span>
              <a href="${storyUrl(siteUrl, w.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:#6b7280;text-decoration:none;line-height:1.5;">${w.summary}</a>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:600;color:#0e7490;text-decoration:none;display:inline-block;margin-top:12px;">Watch →</a>
    </div>
  `
  }).join('')

  const inTheKnowHtml = inTheKnowCategories.map(cat => {
    const items = content.inTheKnow[cat]
    if (!items || items.length === 0) return ''
    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #f3f4f6;">${cat}</div>
        ${items.map(item => {
          const story = item.slug ? storyMap.get(item.slug) : null
          const text = item.slug
            ? `<a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;">${item.text}</a>`
            : item.text
          const meta = story ? (() => {
            const { tier, sourceType } = getSourceTier(story.journalist_username, story.source ?? '', story.category)
            const displayName = story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '').trim() || story.journalist_username || null
            const confidence = CONFIDENCE_LABELS[getConfidenceLabel(story)] ?? null
            const covered = story.msm_outlet_coverage?.covered?.length ?? null
            const total = story.msm_outlet_coverage
              ? story.msm_outlet_coverage.covered.length + story.msm_outlet_coverage.notCovered.length
              : null
            const parts: string[] = []
            if (displayName) parts.push(`<span style="font-weight:600;color:#374151;">${displayName}</span>`)
            if (sourceType) parts.push(`<span>${sourceType}${tier ? ` (Tier ${tier})` : ''}</span>`)
            if (confidence) parts.push(`<span style="font-style:italic;">${confidence}</span>`)
            if (covered !== null && total !== null) parts.push(`<span>${covered} of ${total} outlets</span>`)
            if (story.msm_gap) parts.push(`<span style="font-weight:600;color:#b45309;">Limited Coverage</span>`)
            return parts.length > 0
              ? `<p style="margin:2px 0 6px;font-size:11px;color:#9ca3af;">${parts.join('<span style="margin:0 3px;opacity:0.4;">·</span>')}</p>`
              : ''
          })() : ''
          return `<div style="margin-bottom:8px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">• ${text}</p>
            ${meta}
          </div>`
        }).join('')}
      </div>
    `
  }).join('')

  const etceteraHtml = content.etcetera.length > 0 ? `
    <div style="margin-top:28px;padding:20px 24px;background:#f9fafb;border-radius:8px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">Also worth knowing</div>
      ${content.etcetera.map(item => {
        const etc = typeof item === 'string' ? { text: item, slug: null } : item
        const story = etc.slug ? storyMap.get(etc.slug) : null
        const linked = etc.slug
          ? `<a href="${storyUrl(siteUrl, etc.slug)}" target="_blank" rel="noopener noreferrer" style="color:#374151;text-decoration:none;">${etc.text}</a>`
          : etc.text
        const badges = story
          ? `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:3px;">${renderSourceBadge(story)}${renderConfidenceBadge(story)}${story.msm_gap ? renderMsmBadge(story) : ''}</div>`
          : ''
        return `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">• ${linked}</p>
          ${badges}
        </div>`
      }).join('')}
    </div>
  ` : ''

  const mainstreamPulseHtml = content.mainstreamPulse && content.mainstreamPulse.length > 0 ? `
    <div style="margin-top:28px;padding:20px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Mainstream Pulse</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">What the major outlets are leading with today.</div>
      ${content.mainstreamPulse.map(item => `
        <div style="display:flex;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;">
          <div style="flex-shrink:0;width:72px;padding-top:2px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">${item.source}</div>
            <div style="font-size:8px;color:#cbd5e1;margin-top:1px;">${item.descriptor}</div>
          </div>
          ${item.slug
            ? `<a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:#374151;line-height:1.5;text-decoration:none;">${item.headline}</a>`
            : `<span style="font-size:13px;color:#374151;line-height:1.5;">${item.headline}</span>`
          }
        </div>
      `).join('')}
    </div>
  ` : ''

  const globalBlindspotHtml = content.globalBlindspots && content.globalBlindspots.length > 0 ? `
    <div style="margin-top:28px;padding:20px 24px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#92400e;text-transform:uppercase;margin-bottom:4px;">🌍 Global Blindspot</div>
      <div style="font-size:11px;color:#78716c;margin-bottom:16px;">Stories the rest of the world is covering that US media is ignoring.</div>
      ${content.globalBlindspots.map(item => {
        const story = storyMap.get(item.slug)
        const badges = story
          ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${renderSourceBadge(story)}${renderConfidenceBadge(story)}</div>`
          : ''
        return `
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #fde68a;">
          <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#92400e;text-transform:uppercase;margin-right:6px;">${item.region}</span>
          <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:700;color:#111827;text-decoration:none;">${item.title}</a>
          ${badges}
          <p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#78716c;">${item.summary}</p>
        </div>`
      }).join('')}
    </div>
  ` : ''

  const globalLensHtml = content.globalLens && content.globalLens.length > 0 ? `
    <div style="margin-top:28px;padding:20px 24px;background:#f0fdfc;border:1px solid #99f6e4;border-radius:8px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#0e7490;text-transform:uppercase;margin-bottom:4px;">🌍 Global Lens</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:16px;">How international outlets are covering today's stories — perspectives US media isn't amplifying.</div>
      ${content.globalLens.map(item => {
        const story = storyMap.get(item.slug)
        const badges = story
          ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${renderSourceBadge(story)}${renderConfidenceBadge(story)}</div>`
          : ''
        return `
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #99f6e4;">
          <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#0e7490;text-transform:uppercase;margin-right:6px;">${item.region}</span>
          <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:700;color:#111827;text-decoration:none;">${item.title}</a>
          ${badges}
          <p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">${item.summary}</p>
        </div>`
      }).join('')}
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TopNewsClips — ${formatDate(date)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#ffffff;border-bottom:3px solid #0e7490;padding:20px 32px;">
      <a href="${siteUrlUtm(siteUrl)}" style="text-decoration:none;">
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.03em;color:#111827;">TopNewsClips</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">The full picture, not the profitable picture.</div>
      </a>
      <div style="font-size:12px;color:#9ca3af;margin-top:6px;">${formatDate(date)}</div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <!-- Need to Know -->
      ${needToKnowHtml}

      <!-- In the Know -->
      <div style="margin-top:8px;">
        <div style="font-size:13px;font-weight:800;letter-spacing:0.06em;color:#111827;text-transform:uppercase;margin-bottom:20px;padding-bottom:8px;border-bottom:2px solid #111827;">In The Know</div>
        ${inTheKnowHtml}
      </div>

      ${etceteraHtml}

      ${mainstreamPulseHtml}

      ${globalBlindspotHtml}

      ${globalLensHtml}

    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <a href="${siteUrlUtm(siteUrl)}" style="font-size:13px;font-weight:700;color:#0e7490;text-decoration:none;">topnewsclips.com</a>
      <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">
        You're receiving this because you subscribed at topnewsclips.com.<br>
        <a href="${siteUrl}/api/unsubscribe?email={{email}}" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`
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
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    .select('email')

  if (error) {
    return NextResponse.json({ error: `Failed to fetch subscribers: ${error.message}` }, { status: 500 })
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No subscribers' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://topnewsclips.com'
  const resend = new Resend(resendKey)

  // Collect all slugs referenced in the digest and fetch story objects for badge rendering
  const digestSlugs = new Set<string>([
    ...digest.content.needToKnow.map(i => i.slug),
    ...Object.values(digest.content.inTheKnow).flatMap(items => items.map(i => i.slug).filter(Boolean) as string[]),
    ...(digest.content.etcetera ?? []).map(i => typeof i === 'string' ? null : i.slug).filter(Boolean) as string[],
    ...(digest.content.globalBlindspots ?? []).map(i => i.slug),
    ...(digest.content.globalLens ?? []).map(i => i.slug),
  ])
  const { data: storyRows } = await supabase.from('stories').select('*').in('slug', [...digestSlugs])
  const storyMap = new Map<string, Story>((storyRows ?? []).map((s: Story) => [s.slug, s]))

  const emails = subscribers.map((s: { email: string }) => s.email)
  const baseHtml = buildEmailHtml(digest.content, digest.date, siteUrl, storyMap)
  const baseText = buildEmailText(digest.content, digest.date, siteUrl)
  const subject = `Your briefing — ${formatDate(digest.date)}`

  // Resend supports batch send up to 100 emails per request
  // Each email gets a personalized unsubscribe link
  const BATCH_SIZE = 100
  let sent = 0
  const errors: string[] = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    try {
      await resend.batch.send(
        batch.map(email => ({
          from: 'TopNewsClips <digest@topnewsclips.com>',
          to: email,
          subject,
          html: baseHtml.replace('{{email}}', encodeURIComponent(email)),
          text: baseText.replace('{{unsubscribe}}', `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`),
          headers: {
            'List-Unsubscribe': `<${siteUrl}/api/unsubscribe?email=${encodeURIComponent(email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }))
      )
      sent += batch.length
    } catch (err) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (sent > 0) {
    await supabase.from('digests').update({ email_sent_at: new Date().toISOString() }).eq('id', digest.id)
  }

  return NextResponse.json({ sent, total: emails.length, errors })
}
