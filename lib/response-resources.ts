import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

export function normalizeResponseUrl(value: string): string {
  const url = new URL(value.trim())
  url.hash = ''
  return url.toString()
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getApprovedResponseResources(params: {
  responseTypes?: ResponseType[]
  storyCategory?: StoryCategoryForResponse
  issueArea?: string
  region?: string
  limit?: number
}): Promise<ResponseResource[]> {
  const supabase = getServiceClient()
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

export async function proposeResponseResource(input: {
  responseType: ResponseType
  title: string
  description: string
  url: string
  storyCategory?: StoryCategoryForResponse | null
  issueArea?: string | null
  region?: string | null
  reasonListed?: string | null
  riskLevel?: ResponseResource['riskLevel']
  verificationSources?: string[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isValidResponseUrl(input.url)) return { ok: false, error: 'Valid URL required.' }
  const normalizedUrl = normalizeResponseUrl(input.url)
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('verified_response_resources')
    .select('id')
    .eq('url', normalizedUrl)
    .limit(1)

  if (existing && existing.length > 0) return { ok: false, error: 'Resource already proposed.' }

  const { data, error } = await supabase
    .from('verified_response_resources')
    .insert({
      response_type: input.responseType,
      title: input.title.trim(),
      description: input.description.trim(),
      url: normalizedUrl,
      story_category: input.storyCategory ?? null,
      issue_area: input.issueArea ?? null,
      region: input.region ?? null,
      reason_listed: input.reasonListed ?? null,
      risk_level: input.riskLevel ?? 'medium',
      verification_sources: input.verificationSources ?? [],
      approval_status: 'proposed',
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to propose resource.' }
  return { ok: true, id: data.id as string }
}

export async function approveResponseResource(id: string, adminUserId: string) {
  const supabase = getServiceClient()
  const { data: resource } = await supabase
    .from('verified_response_resources')
    .select('url, reason_listed, verification_sources, risk_level')
    .eq('id', id)
    .single()

  if (!resource?.url || !isValidResponseUrl(resource.url)) return { ok: false, error: 'Valid URL required.' }
  if (!resource.reason_listed || String(resource.reason_listed).trim().length < 10) return { ok: false, error: 'Reason listed required.' }
  if (!Array.isArray(resource.verification_sources) || resource.verification_sources.length === 0) return { ok: false, error: 'Verification source required.' }
  if (!['low', 'medium', 'high'].includes(resource.risk_level)) return { ok: false, error: 'Risk level required.' }

  const { error } = await supabase
    .from('verified_response_resources')
    .update({
      approval_status: 'approved',
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function rejectResponseResource(id: string, adminUserId: string, reason: string) {
  if (reason.trim().length < 10) return { ok: false, error: 'Reason required.' }
  const { error } = await getServiceClient()
    .from('verified_response_resources')
    .update({
      approval_status: 'rejected',
      approved_by: adminUserId,
      reason_listed: reason.trim(),
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}
