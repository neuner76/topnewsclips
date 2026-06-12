import type { DigestContent } from '@/lib/digest'
import type { Story } from '@/lib/types'
import { getSourceTier } from '@/lib/ingest/source-tier'
import { getConfidenceLabel } from '@/lib/confidence'

export const DIGEST_UTM = 'utm_source=email&utm_medium=email&utm_campaign=digest'

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function storyUrl(siteUrl: string, slug: string) { return `${siteUrl}/story/${slug}?${DIGEST_UTM}` }
export function siteUrlUtm(siteUrl: string) { return `${siteUrl}?${DIGEST_UTM}` }

export function formatPublishedDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function sourceHandle(story: Story): string | null {
  if (story.journalist_username) return `@${normalizeHandle(story.journalist_username)}`
  const source = story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '').trim()
  return source ? `@${normalizeHandle(source)}` : null
}

function normalizeHandle(value: string): string {
  const compact = value.replace(/^@/, '').replace(/\s+/g, '').toLowerCase()
  const aliases: Record<string, string> = {
    france24english: 'france24',
    france24en: 'france24',
    france24englishofficial: 'france24',
  }
  return aliases[compact] ?? compact
}

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
  CORROBORATED:    { text: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  REPORTED:        { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  DEVELOPING:      { text: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  'SINGLE-SOURCE': { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  ANALYSIS:        { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

const CONFIDENCE_LABELS: Record<string, string> = {
  CORROBORATED:    'Corroborated',
  REPORTED:        'Reported',
  DEVELOPING:      'Developing',
  'SINGLE-SOURCE': 'Single-source',
  ANALYSIS:        'Analysis',
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
  // Confidence labels are reserved for news — satire shows a content-type badge
  if (label === null) {
    return badge('Cultural lens', CONFIDENCE_COLORS['SINGLE-SOURCE'], true)
  }
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

function renderGlobalMeta(story: Story): string {
  const parts = [formatPublishedDate(story.created_at)]
  const handle = sourceHandle(story)
  if (handle) parts.push(handle)
  return `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">${parts.join('<span style="margin:0 4px;opacity:0.45;">·</span>')}</p>`
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildEmailHtml(content: DigestContent, date: string, siteUrl: string, storyMap: Map<string, Story>): string {
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
      ${item.paragraphs.slice(0, 2).map((p, i) => `<div style="margin-bottom:14px;"><div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;">${i === 0 ? 'What happened' : 'Why it matters'}</div><p style="margin:0;font-size:15px;line-height:1.65;color:#374151;">${p}</p></div>`).join('')}
      ${item.howWorldSeesIt && item.howWorldSeesIt.length > 0 ? `
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">World view</div>
          ${item.howWorldSeesIt.map(w => `
            <div style="display:flex;gap:12px;margin-bottom:6px;">
              <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;flex-shrink:0;width:72px;">${w.region}</span>
              <a href="${storyUrl(siteUrl, w.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:#6b7280;text-decoration:none;line-height:1.5;">${w.summary}</a>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:600;color:#0e7490;text-decoration:none;display:inline-block;margin-top:12px;">Full story →</a>
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
            const confidenceLabel = getConfidenceLabel(story)
            // Satire never carries a confidence label — content-type badge instead
            const confidence = story.category === 'comedy' ? 'Cultural lens' : (confidenceLabel ? CONFIDENCE_LABELS[confidenceLabel] ?? null : null)
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
          ${item.slug || item.url
            ? `<a href="${item.slug ? storyUrl(siteUrl, item.slug) : item.url}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:#374151;line-height:1.5;text-decoration:none;">${item.headline}</a>`
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
        const meta = story ? renderGlobalMeta(story) : ''
        return `
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #fde68a;">
          <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#92400e;text-transform:uppercase;margin-right:6px;">${item.region}</span>
          <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:700;color:#111827;text-decoration:none;">${item.title}</a>
          ${badges}
          ${meta}
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
        const meta = story ? renderGlobalMeta(story) : ''
        return `
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #99f6e4;">
          <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:#0e7490;text-transform:uppercase;margin-right:6px;">${item.region}</span>
          <a href="${storyUrl(siteUrl, item.slug)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:700;color:#111827;text-decoration:none;">${item.title}</a>
          ${badges}
          ${meta}
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
        <a href="{{preferences}}" style="color:#9ca3af;">Tune your briefing</a>
        <span style="color:#d1d5db;"> · </span>
        <a href="{{unsubscribe}}" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

export async function buildStoryMap(
  fetchStories: (slugs: string[]) => Promise<Story[]>,
  content: DigestContent
): Promise<Map<string, Story>> {
  const slugs = [
    ...new Set<string>([
      ...content.needToKnow.map(i => i.slug),
      ...Object.values(content.inTheKnow).flatMap(items => items.map(i => i.slug).filter(Boolean) as string[]),
      ...(content.etcetera ?? []).map(i => typeof i === 'string' ? null : i.slug).filter(Boolean) as string[],
      ...(content.globalBlindspots ?? []).map(i => i.slug),
      ...(content.globalLens ?? []).map(i => i.slug),
    ])
  ]
  const stories = await fetchStories(slugs)
  return new Map(stories.map(s => [s.slug, s]))
}
