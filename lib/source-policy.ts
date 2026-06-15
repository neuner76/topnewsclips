// Source policy reader (Task 8).
//
// Source governance has ONE source of truth: the Supabase `featured_journalists`
// table. This module READS that table into a lookup; it performs no hard-coded
// policy of its own. A parallel TS registry would create a second, conflicting
// source of truth (the "two generations stitched together" problem) — so policy
// status, blocked slots, and blocked sections all live as columns on the table
// (see migration 20260615_source_policy.sql).

import type { SupabaseClient } from '@supabase/supabase-js'

export type SourcePolicyStatus =
  | 'active'
  | 'restricted'
  | 'deactivated'
  | 'pending_reclassification'

export type SourcePolicySlot = 'lead' | 'need_to_know'

export interface SourcePolicy {
  handle?: string
  status: SourcePolicyStatus
  blockedSlots: SourcePolicySlot[]
  blockedSections: string[]
  reason?: string
  updatedAt?: string
}

// Row shape we read. `active = false` is treated as canonical-equivalent to
// `policy_status = 'deactivated'` so the two never drift (a row can be marked
// inactive by older tooling that doesn't know about policy_status).
interface FeaturedJournalistPolicyRow {
  username: string | null
  channel_id?: string | null
  active?: boolean | null
  policy_status?: SourcePolicyStatus | null
  blocked_slots?: string[] | null
  blocked_sections?: string[] | null
  policy_reason?: string | null
  policy_updated_at?: string | null
}

export function rowToPolicy(row: FeaturedJournalistPolicyRow): SourcePolicy {
  // `active = false` wins as deactivated even if policy_status was left 'active'.
  const status: SourcePolicyStatus =
    row.active === false ? 'deactivated' : (row.policy_status ?? 'active')
  return {
    handle: row.username ?? undefined,
    status,
    blockedSlots: (row.blocked_slots ?? []).filter(isSlot),
    blockedSections: row.blocked_sections ?? [],
    reason: row.policy_reason ?? undefined,
    updatedAt: row.policy_updated_at ?? undefined,
  }
}

function isSlot(s: string): s is SourcePolicySlot {
  return s === 'lead' || s === 'need_to_know'
}

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/^@/, '').replace(/\s+/g, '').toLowerCase()
}

// Key the map by normalized handle AND channel_id so a story can be matched by
// whichever identifier it carries.
export async function loadSourcePolicies(
  supabase: SupabaseClient
): Promise<Map<string, SourcePolicy>> {
  const map = new Map<string, SourcePolicy>()
  const { data, error } = await supabase
    .from('featured_journalists')
    .select('username, channel_id, active, policy_status, blocked_slots, blocked_sections, policy_reason, policy_updated_at')
  if (error || !data) return map

  for (const row of data as FeaturedJournalistPolicyRow[]) {
    const policy = rowToPolicy(row)
    const handle = normalizeHandle(row.username)
    if (handle) map.set(handle, policy)
    if (row.channel_id) map.set(row.channel_id, policy)
  }
  return map
}

// Resolve the policy for a story from the loaded map, trying its journalist
// handle first, then its source string (which may embed the handle).
export function policyForStory(
  story: { journalist_username?: string | null; source?: string | null },
  policies: Map<string, SourcePolicy>
): SourcePolicy | undefined {
  const handle = normalizeHandle(story.journalist_username)
  if (handle && policies.has(handle)) return policies.get(handle)
  const fromSource = normalizeHandle(story.source?.replace(/^(YouTube|TikTok|Reddit)\/@?/i, '') ?? null)
  if (fromSource && policies.has(fromSource)) return policies.get(fromSource)
  return undefined
}
