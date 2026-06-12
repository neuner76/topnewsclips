import { createClient } from '@/lib/supabase/server'
import type { ResponseResource, ResponseType, StoryCategoryForResponse } from './response-types'

type ResourceRow = {
  id: string
  response_type: ResponseType
  title: string
  description: string
  url: string
  organization_id: string | null
  approval_status: ResponseResource['approvalStatus']
  risk_level: ResponseResource['riskLevel']
  reason_listed: string | null
  last_reviewed_at: string | null
}

function toResponseResource(row: ResourceRow): ResponseResource {
  return {
    id: row.id,
    responseType: row.response_type,
    title: row.title,
    description: row.description,
    url: row.url,
    organizationId: row.organization_id ?? undefined,
    approvalStatus: row.approval_status,
    riskLevel: row.risk_level,
    reasonListed: row.reason_listed ?? undefined,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
  }
}

export function isValidResponseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function getApprovedResponseResources(params: {
  responseTypes?: ResponseType[]
  storyCategory?: StoryCategoryForResponse
  issueArea?: string
  region?: string
  limit?: number
}): Promise<ResponseResource[]> {
  const supabase = await createClient()
  let query = supabase
    .from('verified_response_resources')
    .select('id, response_type, title, description, url, organization_id, approval_status, risk_level, reason_listed, last_reviewed_at')
    .eq('approval_status', 'approved')
    .limit(params.limit ?? 3)

  if (params.responseTypes?.length) query = query.in('response_type', params.responseTypes)
  if (params.storyCategory) query = query.eq('story_category', params.storyCategory)
  if (params.issueArea) query = query.eq('issue_area', params.issueArea)
  if (params.region) query = query.eq('region', params.region)

  const { data, error } = await query
  if (error || !data) return []
  return (data as ResourceRow[]).filter(row => isValidResponseUrl(row.url)).map(toResponseResource)
}
