export type ResponseType =
  | 'learn'
  | 'track'
  | 'share_responsibly'
  | 'official_process'
  | 'report'
  | 'support_verified_response'
  | 'local_resource'

export type StoryResponseEligibility =
  | 'full'
  | 'limited'
  | 'learn_track_share_only'
  | 'none'

export type StoryCategoryForResponse =
  | 'disaster_relief'
  | 'consumer_fraud'
  | 'public_health_logistics'
  | 'elections_civic_deadlines'
  | 'public_comment_period'
  | 'local_infrastructure_safety'
  | 'geopolitical_conflict'
  | 'contested_partisan_politics'
  | 'active_violence_breaking_crisis'
  | 'culture_novelty_light'
  | 'other'

export interface ResponseResource {
  id: string
  responseType: ResponseType
  title: string
  description: string
  url: string
  sourceName?: string
  organizationId?: string
  approvalStatus: 'proposed' | 'approved' | 'rejected' | 'retired'
  riskLevel: 'low' | 'medium' | 'high'
  reasonListed?: string
  lastReviewedAt?: string
}
