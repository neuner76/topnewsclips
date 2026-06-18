import type { ContentType, TopicRole, SectionFit } from './ingest/classify'

export type Platform = 'youtube' | 'x' | 'tiktok'

export interface Story {
  id: string
  title: string
  slug: string
  description: string
  embed_url: string
  platform: Platform
  view_count: number
  share_count: number
  msm_gap: boolean
  msm_notes: string | null
  msm_outlet_coverage: { covered: string[]; notCovered: string[] } | null
  published: boolean
  display_order: number
  category: 'raw' | 'reported' | 'analysis' | 'comedy' | null
  subcategory: string | null
  // Spec 3.2 — unified classification pass. Optional + null: absent on rows
  // predating the pass, null for items the injection guard holds as
  // needs_review. See lib/ingest/classify.ts.
  content_type?: ContentType | null
  topic_role?: TopicRole | null
  section_fit?: SectionFit | null
  thumbnail_url: string | null
  journalist_username: string | null
  source: string | null
  region: string | null
  source_tier: number | null
  source_type: string | null
  pinned: boolean
  duration: string | null
  created_at: string
  updated_at: string
  verified_interpretation: {
    verified: string[]
    interpretation: string[]
    headerNote?: string
  } | null
  qc_status: 'pass' | 'hold' | null
  qc_failed_checks: { id: string; result: 'pass' | 'fail'; reason: string }[] | null
  qc_routing_note: string | null
  // Major-story sections (Corroborated-threshold coverage only); null when
  // not major or when the generation failed blocking section QC
  in_context?: string | null
  what_we_know?: string[] | null
  what_remains_unclear?: string[] | null
}

export interface Subscriber {
  id: string
  email: string
  confirmed: boolean
  created_at: string
}
