export type TaxonomyKind = 'topic' | 'region' | 'section'
export type FormatPreference = 'digest' | 'clips' | 'both'
export type PacePreference = 'full' | 'skim'

export interface TaxonomyItem {
  id: string
  kind: TaxonomyKind
  slug: string
  label: string
  active: boolean
}

export interface SubscriberPreferences {
  subscriberId: string
  formatPreference: FormatPreference
  pacePreference: PacePreference
  topicIds: string[]
  regionIds: string[]
  sectionIds: string[]
  keywords: string[]
}

export interface PreferencePayload {
  formatPreference: FormatPreference
  pacePreference: PacePreference
  topicIds: string[]
  regionIds: string[]
  sectionIds: string[]
  keywords: string[]
}
