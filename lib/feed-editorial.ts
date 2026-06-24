import { getConfidenceLabel } from './confidence'
import type { Story } from './types'

export type FeedSectionName =
  | 'Need To Know'
  | 'Politics & World Affairs'
  | 'Science & Technology'
  | 'Business & Markets'
  | 'Sports, Entertainment, & Culture'
  | 'Health / Environment'
  | 'Global Blindspot'
  | 'Global Lens'
  | 'Mainstream Pulse'
  | 'Also Worth Knowing'
  | 'Limited Coverage'
  | string

export function coverageCount(story: Pick<Story, 'msm_outlet_coverage'>): number {
  return story.msm_outlet_coverage?.covered?.length ?? 0
}

// The coverage DENOMINATOR is the constant count of tracked MSM outlets (15 =
// MSM_OUTLET_COUNT in lib/ingest/msm-check.ts), never the per-story array length.
// A corrupted coverage array — e.g. a reverify/satire write producing sum 2 or
// 14 — must not render an inconsistent "of 2"/"of 14" and trip the verifier's
// denominator_consistency check. Only the numerator (covered) varies per story.
export function coverageTotal(): number {
  return 15
}

export function coverageText(story: Pick<Story, 'msm_outlet_coverage'>): string {
  return `${coverageCount(story)} of ${coverageTotal()} outlets`
}

export function isZeroCoverageStory(story: Pick<Story, 'msm_outlet_coverage'>): boolean {
  return coverageCount(story) === 0
}

export function isLowerConfidenceStory(story: Story, sourceType?: string | null): boolean {
  const confidence = getConfidenceLabel(story)
  return (
    confidence === 'SINGLE-SOURCE' ||
    confidence === 'DEVELOPING' ||
    sourceType === 'Raw Footage' ||
    sourceType === 'Community Sourced' ||
    isZeroCoverageStory(story)
  )
}

export function isLimitedSourceNeedToKnow(story: Story, section?: FeedSectionName): boolean {
  if (section !== 'Need To Know') return false

  const count = coverageCount(story)
  const total = coverageTotal()
  const ratio = total > 0 ? count / total : 0
  const confidence = getConfidenceLabel(story)
  const notes = story.msm_notes?.toLowerCase() ?? ''

  return (
    count === 0 ||
    ratio < 0.2 ||
    confidence === 'SINGLE-SOURCE' ||
    confidence === 'DEVELOPING' ||
    notes.includes('limited sources') ||
    isLowerConfidenceStory(story, story.source_type)
  )
}

export function emergingSignalCopy(position: number): string {
  if (position === 0) {
    return 'This story leads because it may be important and undercovered. Details may develop.'
  }
  return 'This story may be important and undercovered. Details may develop.'
}

export function shouldShowZeroCoverageCaution(section: FeedSectionName, story: Story, options?: {
  singleSourceInternationalReport?: boolean
}): boolean {
  if (!isZeroCoverageStory(story)) return false
  if (options?.singleSourceInternationalReport) return false
  if (['Need To Know', 'Mainstream Pulse', 'Also Worth Knowing', 'Global Blindspot', 'Limited Coverage'].includes(section)) return false
  return true
}

export function shouldCompactStoryInSection(section: FeedSectionName, story: Story, sourceType?: string | null): boolean {
  if (section === 'Need To Know') return false
  if (['Global Blindspot', 'Mainstream Pulse'].includes(section)) return false
  return isZeroCoverageStory(story) || isLowerConfidenceStory(story, sourceType)
}

export function hasPrimarySectionOverride(story: Story): boolean {
  return story.pinned || story.display_order <= 20
}

export function isWeakPrimarySingleton(story: Story, sourceType?: string | null): boolean {
  if (hasPrimarySectionOverride(story)) return false
  const tier = story.source_tier ?? 99
  const lowerStakes = story.category === 'comedy' || story.category === 'raw'
  return (
    isZeroCoverageStory(story) ||
    getConfidenceLabel(story) === 'SINGLE-SOURCE' ||
    tier >= 7 ||
    sourceType === 'Raw Footage' ||
    sourceType === 'Community Sourced' ||
    lowerStakes
  )
}

export function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return `${words.slice(0, maxWords).join(' ')}...`
}

export function stripSourceBoilerplate(text: string): string {
  return text
    .replace(/\bWatch\b[^.!\n]*(?:\bon\b|\bat\b)[^.!\n]*(?:[.!\n]|$)/gi, '')
    .replace(/\bStream\b[^.!\n]*(?:\bon\b|\bat\b)[^.!\n]*(?:[.!\n]|$)/gi, '')
    .replace(/\bFollow\b[^.!\n]*(?:\bon\b|\bat\b)[^.!\n]*(?:[.!\n]|$)/gi, '')
    .replace(/\bSubscribe\b[^.!\n]*(?:\bon\b|\bat\b)[^.!\n]*(?:[.!\n]|$)/gi, '')
    .replace(/\bAvailable on\b[^.!\n]*(?:[.!\n]|$)/gi, '')
    .replace(/\braises questions officials are now working to answer about\b/gi, 'left officials working to determine')
    .replace(/\braises questions about\b/gi, 'has prompted scrutiny of')
    .replace(/\bsparks concerns about\b/gi, 'has prompted concern about')
    .replace(/\bin a notable development\b/gi, '')
    .replace(/\breportedly significant\b/gi, 'significant')
    .replace(/\bunder these circumstances\b/gi, 'in this case')
    .replace(/\bin this way\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function displaySummary(text: string | null | undefined, maxWords: number): string {
  if (!text) return ''
  return clampWords(stripSourceBoilerplate(text), maxWords)
}

function normalizeOutletName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(youtube|tiktok|reddit)\//, '')
    .replace(/^@/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function outletNameForStory(story: Pick<Story, 'source' | 'journalist_username'> | null): string | null {
  if (!story) return null
  const source = story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '').trim()
  return source || story.journalist_username || null
}

export function validateGlobalLensSourceConsistency(item: {
  summary?: string | null
  text?: string | null
  outletName?: string | null
}, story: Pick<Story, 'source' | 'journalist_username'> | null = null): { valid: boolean; reason?: string } {
  const outlet = normalizeOutletName(item.outletName ?? outletNameForStory(story) ?? '')
  const text = normalizeOutletName(item.summary ?? item.text ?? '')

  if (!outlet) return { valid: false, reason: 'Missing outlet name' }

  const knownOutlets = [
    'dw news',
    'al jazeera',
    'france 24',
    'wion',
    'abc australia',
    'trt world',
    'bbc',
    'reuters',
    'ap',
    'associated press',
  ]

  const outletAliases: Record<string, string[]> = {
    'dw news': ['dw', 'dwnews', 'deutsche welle'],
    'al jazeera': ['al jazeera english'],
    'france 24': ['france24'],
    ap: ['associated press'],
  }
  const compactOutlet = outlet.replace(/\s+/g, '')
  const allowedNames = new Set([
    outlet,
    compactOutlet,
    ...(outletAliases[outlet] ?? []),
    ...Object.entries(outletAliases)
      .filter(([canonical, aliases]) => canonical === outlet || canonical.replace(/\s+/g, '') === compactOutlet || aliases.includes(outlet) || aliases.includes(compactOutlet))
      .flatMap(([canonical, aliases]) => [canonical, canonical.replace(/\s+/g, ''), ...aliases]),
  ])
  const mentionedOtherOutlet = knownOutlets.find(name => {
    if (allowedNames.has(name) || allowedNames.has(name.replace(/\s+/g, ''))) return false
    if (outlet.includes(name) || name.includes(outlet)) return false
    return text.includes(name)
  })

  if (mentionedOtherOutlet) {
    return {
      valid: false,
      reason: `Summary mentions ${mentionedOtherOutlet} but card outlet is ${outlet}`,
    }
  }

  return { valid: true }
}

export function globalLensDisplayText(summary: string): string {
  const clean = stripSourceBoilerplate(summary)
  const firstSentence = clean.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? clean
  return clampWords(firstSentence, 45)
}
