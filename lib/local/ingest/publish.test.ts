import { describe, expect, it } from 'vitest'
import { decidePublish, type PublishInput } from './publish'

const ok: PublishInput = {
  eventType: 'weather_alert',
  autoPublish: true,
  autoPublishMinEvidenceLevel: 1,
  minGeoPrecision: 'county',
  geoPrecision: 'county',
  attachedEvidenceLevels: [1],
  hasRequiredFields: true,
  textValid: true,
}

describe('decidePublish (§10)', () => {
  it('publishes when every check passes', () => {
    expect(decidePublish(ok).state).toBe('published')
  })
  it('never auto-publishes public_safety / community_report', () => {
    expect(decidePublish({ ...ok, eventType: 'public_safety' }).state).toBe('held')
    expect(decidePublish({ ...ok, eventType: 'community_report' }).state).toBe('held')
  })
  it('holds when auto_publish is false', () => {
    expect(decidePublish({ ...ok, autoPublish: false }).reason).toContain('auto_publish=false')
  })
  it('holds without a sufficiently-official item', () => {
    expect(decidePublish({ ...ok, attachedEvidenceLevels: [2, 3] }).reason).toContain('evidence_level<=1')
  })
  it('holds when geo precision is coarser than required', () => {
    expect(decidePublish({ ...ok, minGeoPrecision: 'segment', geoPrecision: 'county' }).reason).toContain('coarser')
    // finer than required is fine
    expect(decidePublish({ ...ok, minGeoPrecision: 'county', geoPrecision: 'exact' }).state).toBe('published')
  })
  it('holds on missing fields or invalid text', () => {
    expect(decidePublish({ ...ok, hasRequiredFields: false }).reason).toContain('required fields')
    expect(decidePublish({ ...ok, textValid: false }).reason).toContain('validation')
  })
})
