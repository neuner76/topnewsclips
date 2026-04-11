import type { Story } from '@/lib/types'

export type ConfidenceLabel = 'CORROBORATED' | 'REPORTED' | 'DEVELOPING' | 'SINGLE-SOURCE' | 'ANALYSIS'

export function getConfidenceLabel(story: Pick<Story, 'category' | 'source_tier' | 'msm_outlet_coverage' | 'msm_gap'>): ConfidenceLabel {
  // Analysis/commentary is always labeled as such regardless of coverage
  if (story.category === 'analysis') return 'ANALYSIS'

  const coveredCount = story.msm_outlet_coverage?.covered?.length ?? 0
  const tier = story.source_tier ?? 10

  // Multiple independent outlets confirm the story
  if (coveredCount >= 5) return 'CORROBORATED'
  if (coveredCount >= 3 && tier <= 5) return 'CORROBORATED'

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
    description: 'Multiple independent sources confirm the core facts.',
    className: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]',
  },
  REPORTED: {
    label: 'Reported',
    description: 'Published by a credible source with editorial standards, not yet independently corroborated.',
    className: 'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]',
  },
  DEVELOPING: {
    label: 'Developing',
    description: 'Event confirmed but key details still emerging or conflicting across sources.',
    className: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',
  },
  'SINGLE-SOURCE': {
    label: 'Single-source',
    description: 'One source, not yet independently verified.',
    className: 'text-muted-foreground bg-muted border-border',
  },
  ANALYSIS: {
    label: 'Analysis',
    description: 'Interpretation or commentary — not original fact reporting.',
    className: 'text-muted-foreground bg-muted border-border',
    italic: true,
  },
}
