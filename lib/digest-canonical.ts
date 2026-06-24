import { getConfidenceLabel } from './confidence'
import {
  clampWords,
  coverageCount,
  coverageTotal,
  displaySummary,
  globalLensDisplayText,
  outletNameForStory,
} from './feed-editorial'
import { getSourceTier } from './ingest/source-tier'
import type {
  Digest,
  DigestContent,
  GlobalBlindspotItem,
  GlobalLensItem,
  InTheKnowItem,
  MainstreamPulseItem,
  NeedToKnowItem,
} from './digest'
import type { Story } from './types'

export type CanonicalDigestSectionName =
  | 'Need To Know'
  | 'Politics & World Affairs'
  | 'Science, Health & Environment'
  | 'Business & Markets'
  | 'Culture, Media & Society'
  | 'Also Worth Knowing'
  | 'Mainstream Pulse'
  | 'Global Blindspot'
  | 'Global Lens'

export interface DigestMetadata {
  source: string | null
  sourceType: string | null
  sourceTier: number | null
  confidence: string | null
  coverageCount: number | null
  coverageTotal: number | null
  handle: string | null
  caution?: string | null
}

export interface CanonicalDigestItem {
  id: string
  section: CanonicalDigestSectionName
  title: string
  summary: string
  url: string | null
  metadata: DigestMetadata
}

export interface CanonicalNeedToKnowItem extends CanonicalDigestItem {
  section: 'Need To Know'
  whatHappened: string
  whyItMatters: string
  worldView: CanonicalDigestItem[]
}

export interface CanonicalDigestSection {
  name: CanonicalDigestSectionName
  items: CanonicalDigestItem[]
  omittedCount?: number
}

export interface CanonicalMainstreamPulse {
  synthesis: string
  items: MainstreamPulseItem[]
}

export interface DigestEdition {
  id: string
  date: string
  title: string
  needToKnow: CanonicalNeedToKnowItem[]
  sections: CanonicalDigestSection[]
  mainstreamPulse: CanonicalMainstreamPulse | null
  globalBlindspot: CanonicalDigestItem[]
  globalLens: CanonicalDigestItem[]
}

export const DIGEST_SECTION_LIMITS: Record<string, number> = {
  'Politics & World Affairs': 4,
  'Science, Health & Environment': 2,
  'Business & Markets': 2,
  'Culture, Media & Society': 2,
  'Also Worth Knowing': 3,
  'Global Blindspot': 4,
  'Global Lens': 4,
}

export const CANONICAL_IN_THE_KNOW_SECTIONS = [
  {
    sourceKeys: ['Politics & World Affairs'] as const,
    name: 'Politics & World Affairs' as const,
  },
  {
    sourceKeys: ['Science & Technology'] as const,
    name: 'Science, Health & Environment' as const,
  },
  {
    sourceKeys: ['Business & Markets'] as const,
    name: 'Business & Markets' as const,
  },
  {
    sourceKeys: ['Sports, Entertainment, & Culture', 'Comedy & Satire'] as const,
    name: 'Culture, Media & Society' as const,
  },
]

export function storyUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/story/${slug}`
}

function sourceDisplayName(story: Story | undefined): string | null {
  if (!story) return null
  return story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '').trim() || story.journalist_username || null
}

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null
  return `@${value.replace(/^@/, '').replace(/\s+/g, '').toLowerCase()}`
}

export function metadataForStory(story: Story | undefined): DigestMetadata {
  if (!story) {
    return {
      source: null,
      sourceType: null,
      sourceTier: null,
      confidence: null,
      coverageCount: null,
      coverageTotal: null,
      handle: null,
    }
  }

  const fresh = getSourceTier(story.journalist_username, story.source ?? '', story.category)
  const sourceTier = fresh.tier ?? story.source_tier ?? null
  const sourceType = fresh.sourceType ?? story.source_type ?? null
  const confidenceLabel = getConfidenceLabel(story)
  const confidence = story.category === 'comedy'
    ? 'Cultural lens'
    : confidenceLabel
      ? confidenceLabel.toLowerCase().replace(/(^|-)([a-z])/g, (_, sep: string, char: string) => `${sep}${char.toUpperCase()}`)
      : null

  return {
    source: sourceDisplayName(story),
    sourceType,
    sourceTier,
    confidence,
    coverageCount: coverageCount(story),
    coverageTotal: coverageTotal(),
    handle: normalizeHandle(story.journalist_username),
    caution: story.msm_gap ? 'Limited Coverage' : null,
  }
}

export function formatDigestMetadata(metadata: DigestMetadata, options: {
  includeHandle?: boolean
  includeTier?: boolean
  includeCoverage?: boolean
  includeCaution?: boolean
} = {}): string {
  const parts: string[] = []
  if (metadata.source) parts.push(metadata.source)
  if (metadata.sourceType) {
    parts.push(options.includeTier && metadata.sourceTier
      ? `${metadata.sourceType} (Tier ${metadata.sourceTier})`
      : metadata.sourceType)
  }
  if (metadata.confidence) parts.push(metadata.confidence)
  if (options.includeCoverage !== false && metadata.coverageCount !== null && metadata.coverageTotal !== null) {
    parts.push(`${metadata.coverageCount} of ${metadata.coverageTotal} outlets`)
  }
  if (options.includeHandle && metadata.handle) parts.push(metadata.handle)
  if (options.includeCaution && metadata.caution) parts.push(metadata.caution)
  return parts.join(' · ')
}

function firstSentence(text: string): string {
  const clean = text.trim()
  return clean.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? clean
}

function itemFromStory(
  section: CanonicalDigestSectionName,
  slug: string | null,
  title: string,
  summary: string,
  storyMap: Map<string, Story>,
  siteUrl: string,
  maxWords: number
): CanonicalDigestItem {
  const story = slug ? storyMap.get(slug) : undefined
  return {
    id: slug ?? title,
    section,
    title,
    summary: displaySummary(firstSentence(summary), maxWords),
    url: slug ? storyUrl(siteUrl, slug) : null,
    metadata: metadataForStory(story),
  }
}

function buildNeedToKnowItem(item: NeedToKnowItem, storyMap: Map<string, Story>, siteUrl: string): CanonicalNeedToKnowItem {
  const story = storyMap.get(item.slug)
  const whatHappened = displaySummary(item.paragraphs[0] ?? story?.description ?? '', 70)
  const whyItMatters = displaySummary(item.paragraphs[1] ?? '', 60)
  return {
    id: item.slug,
    section: 'Need To Know',
    title: item.sectionTitle,
    summary: [whatHappened, whyItMatters].filter(Boolean).join(' '),
    whatHappened,
    whyItMatters,
    url: storyUrl(siteUrl, item.slug),
    metadata: metadataForStory(story),
    worldView: (item.howWorldSeesIt ?? []).slice(0, 2).map(world => itemFromStory(
      'Global Lens',
      world.slug,
      world.title ?? world.region,
      `${world.region}: ${world.summary}`,
      storyMap,
      siteUrl,
      40
    )),
  }
}

function buildInTheKnowSection(
  content: DigestContent,
  section: (typeof CANONICAL_IN_THE_KNOW_SECTIONS)[number],
  storyMap: Map<string, Story>,
  siteUrl: string
): CanonicalDigestSection {
  const rawItems = section.sourceKeys.flatMap(key => content.inTheKnow[key] ?? [])
  const limit = DIGEST_SECTION_LIMITS[section.name]
  const items = rawItems.slice(0, limit).map((item: InTheKnowItem) => itemFromStory(
    section.name,
    item.slug,
    item.slug ? storyMap.get(item.slug)?.title ?? item.text : item.text,
    item.text,
    storyMap,
    siteUrl,
    34
  ))
  return {
    name: section.name,
    items,
    omittedCount: Math.max(0, rawItems.length - items.length),
  }
}

function buildAlsoWorthKnowing(content: DigestContent, storyMap: Map<string, Story>, siteUrl: string): CanonicalDigestSection {
  const rawItems = content.etcetera ?? []
  const limit = DIGEST_SECTION_LIMITS['Also Worth Knowing']
  const items = rawItems.slice(0, limit).map(item => {
    const normalized = typeof item === 'string' ? { text: item, slug: null } : item
    return itemFromStory('Also Worth Knowing', normalized.slug, normalized.text, normalized.text, storyMap, siteUrl, 28)
  })
  return {
    name: 'Also Worth Knowing',
    items,
    omittedCount: Math.max(0, rawItems.length - items.length),
  }
}

function blindspotItem(item: GlobalBlindspotItem, storyMap: Map<string, Story>, siteUrl: string): CanonicalDigestItem {
  return itemFromStory('Global Blindspot', item.slug, item.title, item.summary, storyMap, siteUrl, 55)
}

function lensItem(item: GlobalLensItem, storyMap: Map<string, Story>, siteUrl: string): CanonicalDigestItem {
  const story = storyMap.get(item.slug)
  const outlet = outletNameForStory(story ?? null)
  const summary = normalizeLensOutletLead(globalLensDisplayText(item.summary))
  const startsWithOutlet = outlet ? startsWithOutletOrAlias(summary, outlet) : false
  const adjustedSummary = outlet && !startsWithOutlet
    ? `${outlet} ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`
    : summary
  return itemFromStory('Global Lens', item.slug, item.title, adjustedSummary, storyMap, siteUrl, 45)
}

function startsWithOutletOrAlias(summary: string, outlet: string): boolean {
  const compactOutlet = outlet.toLowerCase().replace(/[^a-z0-9]/g, '')
  const aliases = new Set([
    outlet.toLowerCase(),
    compactOutlet,
    ...(compactOutlet.includes('aljazeera') ? ['al jazeera', 'aljazeera'] : []),
    ...(compactOutlet.includes('dw') ? ['dw', 'deutsche welle'] : []),
    ...(compactOutlet.includes('france24') ? ['france 24', 'france24'] : []),
    ...(compactOutlet.includes('arirang') ? ['arirang', 'arirang news'] : []),
    ...(compactOutlet.includes('trtworld') ? ['trt world', 'trtworld'] : []),
    ...(compactOutlet.includes('abcnewsaustralia') ? ['abc news australia'] : []),
    ...(compactOutlet.includes('africanews') ? ['africanews'] : []),
  ])
  const lower = summary.toLowerCase()
  const compactSummary = lower.replace(/[^a-z0-9]/g, '')
  return [...aliases].some(alias => lower.startsWith(alias) || compactSummary.startsWith(alias.replace(/[^a-z0-9]/g, '')))
}

function normalizeLensOutletLead(summary: string): string {
  return summary
    .replace(/^al\s+jazeera\b/i, 'Al Jazeera')
    .replace(/^dw\b/i, 'DW')
    .replace(/^france\s*24\b/i, 'France 24')
    .replace(/^trt\s+world\b/i, 'TRT World')
    .replace(/^abc\s+news\s+australia\b/i, 'ABC News Australia')
    .replace(/^africanews\b/i, 'Africanews')
    .replace(/^arirang\s+news\b/i, 'Arirang News')
}

export function deriveMainstreamPulseSynthesis(items: MainstreamPulseItem[] = []): string {
  if (items.length === 0) return ''
  const topicForHeadline = (headline: string): string => {
    const text = headline.toLowerCase()
    if (/\bsunscreen|fda|health|drug|medical\b/.test(text)) return 'health regulation'
    if (/\bmamdani|d\.?s\.?a\.?|police|mayor|court|election\b/.test(text)) return 'domestic politics'
    if (/\biran|hormuz|drone|forces|war|missile\b/.test(text)) return 'Iran and security'
    if (/\btrade|tariff|ustr|india|china\b/.test(text)) return 'trade'
    if (/\bspacex|ipo|stock|market|economic\b/.test(text)) return 'markets'
    if (/\bimmigration|border|asylum|migration\b/.test(text)) return 'migration'
    return 'separate national stories'
  }
  const topics = [...new Set(items.map(item => topicForHeadline(item.headline)))].slice(0, 5)
  if (topics.length <= 2) {
    return "Today's major-outlet agenda clusters around a few lead stories, with different outlets emphasizing different angles."
  }
  return clampWords(`Today's major-outlet agenda is split across ${topics.join(', ')}.`, 35)
}

export function buildDigestEdition(digest: Digest, storyMap: Map<string, Story>, siteUrl: string): DigestEdition {
  // A section with no true-fit story is omitted entirely (spec 5.4) — including
  // Also Worth Knowing, which previously always rendered even when empty. An
  // empty slot is what creates demand for filler, so we remove the slot.
  const sections = [
    ...CANONICAL_IN_THE_KNOW_SECTIONS.map(section => buildInTheKnowSection(digest.content, section, storyMap, siteUrl)),
    buildAlsoWorthKnowing(digest.content, storyMap, siteUrl),
  ].filter(section => section.items.length > 0)

  const blindspots = (digest.content.globalBlindspots ?? [])
    .slice(0, DIGEST_SECTION_LIMITS['Global Blindspot'])
    .map(item => blindspotItem(item, storyMap, siteUrl))

  const lens = (digest.content.globalLens ?? [])
    .slice(0, DIGEST_SECTION_LIMITS['Global Lens'])
    .map(item => lensItem(item, storyMap, siteUrl))

  return {
    id: digest.id,
    date: digest.date,
    title: `TopNewsClips - ${digest.date}`,
    needToKnow: digest.content.needToKnow.map(item => buildNeedToKnowItem(item, storyMap, siteUrl)),
    sections,
    mainstreamPulse: digest.content.mainstreamPulse?.length
      ? {
        synthesis: deriveMainstreamPulseSynthesis(digest.content.mainstreamPulse),
        items: digest.content.mainstreamPulse,
      }
      : null,
    globalBlindspot: blindspots,
    globalLens: lens,
  }
}

export interface DigestValidationResult {
  errors: string[]
  warnings: string[]
}

const VAGUE_WORLD_VIEW_LABELS = new Set(['korea', 'europe', 'middle east', 'africa', 'asia', 'global', 'international'])

export function validateDigestEdition(edition: DigestEdition): DigestValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.date)) errors.push(`Invalid digest date: ${edition.date}`)
  if (edition.needToKnow.length === 0) errors.push('Need To Know is empty')
  if (!edition.mainstreamPulse?.synthesis && edition.mainstreamPulse?.items.length) warnings.push('Mainstream Pulse is missing synthesis')

  const seen = new Set<string>()
  const checkItem = (item: CanonicalDigestItem) => {
    if (seen.has(item.id)) warnings.push(`Duplicate canonical item id: ${item.id}`)
    seen.add(item.id)
    if (!item.url && item.section !== 'Mainstream Pulse') warnings.push(`${item.section} item has no URL: ${item.title}`)
    if (!item.metadata.sourceType) warnings.push(`${item.section} item missing source type: ${item.id}`)
    if (!item.metadata.confidence) warnings.push(`${item.section} item missing confidence: ${item.id}`)
  }

  for (const item of edition.needToKnow) {
    checkItem(item)
    if ((item.whatHappened.split(/\s+/).length + item.whyItMatters.split(/\s+/).length) > 130) {
      warnings.push(`Need To Know item exceeds email-first length: ${item.id}`)
    }
    for (const world of item.worldView) {
      if (VAGUE_WORLD_VIEW_LABELS.has(world.title.toLowerCase())) warnings.push(`World View label is vague: ${world.title}`)
      checkItem(world)
    }
  }

  for (const section of edition.sections) {
    const limit = DIGEST_SECTION_LIMITS[section.name]
    if (limit && section.items.length > limit) warnings.push(`${section.name} exceeds cap (${section.items.length}/${limit})`)
    for (const item of section.items) {
      checkItem(item)
      if (section.name === 'Also Worth Knowing') {
        const strong = (item.metadata.sourceTier ?? 99) <= 3 &&
          item.metadata.confidence === 'Corroborated' &&
          (item.metadata.coverageCount ?? 0) >= 5
        if (strong) warnings.push(`High-strength story belongs above Also Worth Knowing: ${item.id}`)
      }
    }
  }

  for (const item of edition.globalBlindspot) {
    checkItem(item)
    if (item.summary.split(/\s+/).length > 55) warnings.push(`Global Blindspot too long: ${item.id}`)
  }

  for (const item of edition.globalLens) {
    checkItem(item)
    if (item.summary.split(/\s+/).length > 45) warnings.push(`Global Lens too long: ${item.id}`)
  }

  return { errors, warnings }
}

export function canonicalItemIds(edition: DigestEdition): string[] {
  return [
    ...edition.needToKnow.map(item => item.id),
    ...edition.sections.flatMap(section => section.items.map(item => item.id)),
    ...(edition.mainstreamPulse?.items.map(item => item.slug ?? item.url ?? item.headline) ?? []),
    ...edition.globalBlindspot.map(item => item.id),
    ...edition.globalLens.map(item => item.id),
  ]
}
