// Mainstream Pulse link integrity (Tasks 13–14).
//
// Mainstream Pulse exists to show what the major outlets are leading with, so
// each item must link to the ORIGINAL external outlet story — never an internal
// TopNewsClips /story/youtube-* page — unless explicitly marked as internal
// context. The live items are fetched from Google News RSS (already external),
// but a regression that points them at internal pages would silently break the
// section's purpose, so this is a send-blocking validation.

// Optional link-mode marker. Existing items carry { headline, source, url, slug }
// with no linkMode; absence defaults to 'external_source'.
export type MainstreamPulseLinkMode = 'external_source' | 'internal_context'

export interface PulseLinkItem {
  headline?: string
  source?: string
  url?: string | null
  slug?: string | null
  linkMode?: MainstreamPulseLinkMode
}

export function isInternalTopNewsClipsUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // Internal story routes are relative (/story/…) or point at our own host.
  if (/^\/story\//.test(url)) return true
  if (/\/story\/youtube-/.test(url)) return true
  if (/^https?:\/\/[^/]*topnewsclips[^/]*\/story\//i.test(url)) return true
  return false
}

export interface PulseLinkIssue {
  headline: string
  severity: 'error' | 'warning'
  message: string
}

export function validateMainstreamPulseLinks(items: PulseLinkItem[]): PulseLinkIssue[] {
  const issues: PulseLinkIssue[] = []
  for (const item of items) {
    const headline = item.headline ?? '(untitled)'
    const mode = item.linkMode ?? 'external_source'

    if (mode === 'external_source') {
      if (!item.url) {
        issues.push({ headline, severity: 'error', message: 'Mainstream Pulse item is missing its external source link.' })
        continue
      }
      if (isInternalTopNewsClipsUrl(item.url)) {
        issues.push({
          headline,
          severity: 'error',
          message: `Mainstream Pulse item must link to the original external source or explicitly use internal_context mode; found internal link ${item.url}.`,
        })
      }
    }
  }
  return issues
}
