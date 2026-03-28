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
  published: boolean
  display_order: number
  category: 'raw' | 'reported' | 'analysis' | null
  subcategory: string | null
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
}

export interface Subscriber {
  id: string
  email: string
  confirmed: boolean
  created_at: string
}
