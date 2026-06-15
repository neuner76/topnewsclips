import { describe, expect, it } from 'vitest'
import { rowToPolicy, policyForStory, type SourcePolicy } from './source-policy'

describe('source policy reader (Task 8)', () => {
  it('treats active=false as deactivated even if policy_status is still active', () => {
    const policy = rowToPolicy({ username: 'oldsource', active: false, policy_status: 'active' })
    expect(policy.status).toBe('deactivated')
  })

  it('reads policy_status, slots, and sections from the row', () => {
    const policy = rowToPolicy({
      username: 'vicenews',
      active: true,
      policy_status: 'pending_reclassification',
      blocked_slots: ['lead', 'need_to_know', 'bogus'],
      blocked_sections: ['Politics & World Affairs'],
      policy_reason: 'under review',
    })
    expect(policy.status).toBe('pending_reclassification')
    expect(policy.blockedSlots).toEqual(['lead', 'need_to_know']) // 'bogus' filtered out
    expect(policy.blockedSections).toEqual(['Politics & World Affairs'])
  })

  it('resolves a story to its policy by normalized handle', () => {
    const policies = new Map<string, SourcePolicy>([
      ['vicenews', { handle: 'vicenews', status: 'pending_reclassification', blockedSlots: ['lead'], blockedSections: [] }],
    ])
    expect(policyForStory({ journalist_username: '@VICENews' }, policies)?.status).toBe('pending_reclassification')
    // resolves via the source string too ("VICE News" -> "vicenews")
    expect(policyForStory({ source: 'YouTube/VICE News', journalist_username: null }, policies)?.status).toBe('pending_reclassification')
    expect(policyForStory({ journalist_username: 'someoneelse' }, policies)).toBeUndefined()
  })
})
