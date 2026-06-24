import type { Story } from '@/lib/types'

export type ConfidenceLabel = 'CORROBORATED' | 'REPORTED' | 'DEVELOPING' | 'SINGLE-SOURCE' | 'ANALYSIS'

export function getConfidenceLabel(story: Pick<Story, 'category' | 'source_tier' | 'msm_outlet_coverage' | 'msm_gap'>): ConfidenceLabel | null {
  // Confidence labels are reserved for news content. Satire/comedy never
  // carries one — surfaces render a "Cultural lens" content-type badge
  // instead (see ConfidenceBadge). Enforced here so every consumer
  // (site, email, QC) inherits the rule.
  if (story.category === 'comedy') return null

  // Analysis/commentary is always labeled as such regardless of coverage
  if (story.category === 'analysis') return 'ANALYSIS'

  const coveredCount = story.msm_outlet_coverage?.covered?.length ?? 0
  const tier = story.source_tier ?? 10

  // Multiple independent outlets confirm the story. A state-affiliated / low-trust
  // origin (Tier 8+) is NOT auto-corroborated on raw outlet count alone: the count
  // can be syndicated echoes of a single state narrative rather than independent
  // confirmation (spec B3 — interim until the corroboration object distinguishes
  // independent from syndicated). Such stories fall through to DEVELOPING below.
  if (tier < 8) {
    if (coveredCount >= 5) return 'CORROBORATED'
    if (coveredCount >= 3 && tier <= 5) return 'CORROBORATED'
  }

  // Credible institutional source (Tiers 1–6) — even without external corroboration,
  // the source has editorial oversight and a corrections policy
  if (tier <= 6) return 'REPORTED'

  // Tier 7–10 with some external coverage
  if (coveredCount >= 2) return 'DEVELOPING'

  return 'SINGLE-SOURCE'
}

export interface ConfidenceMeta {
  label: string
  description: string
  className: string
  italic?: boolean
}

export const CONFIDENCE_META: Record<ConfidenceLabel, ConfidenceMeta> = {
  CORROBORATED: {
    label: 'Corroborated',
    description: '5+ independent outlets or 3+ outlets including Tier 1-5 sources confirm the core facts.',
    className: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
  },
  REPORTED: {
    label: 'Reported',
    description: 'Published by a Tier 1-6 source with editorial oversight and corrections policy.',
    className: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
  },
  DEVELOPING: {
    label: 'Developing',
    description: 'Event confirmed by 2+ sources but key details still emerging or conflicting.',
    className: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',
  },
  'SINGLE-SOURCE': {
    label: 'Single-source',
    description: 'One source reporting this, not yet independently verified.',
    className: 'text-muted-foreground bg-muted border-border',
  },
  ANALYSIS: {
    label: 'Analysis',
    description: 'Interpretation, synthesis, or commentary — not original fact reporting.',
    className: 'text-muted-foreground bg-muted border-border',
    italic: true,
  },
}
