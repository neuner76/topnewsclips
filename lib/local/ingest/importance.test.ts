import { describe, expect, it } from 'vitest'
import { computeImportance } from './importance'

const now = new Date('2026-09-25T12:00:00Z')

describe('computeImportance (§9)', () => {
  it('scales outages by log10(customers)', () => {
    // base 30 + min(40, 10*log10(2840)) = 30 + 34.5 → 65 (rounded), no urgency/novelty
    expect(computeImportance({ baseImportance: 30, eventType: 'power_outage', fields: { customers: 2840 }, now })).toBe(65)
  })
  it('road closures: +25 major route, +10 otherwise', () => {
    expect(computeImportance({ baseImportance: 45, eventType: 'road_closure', fields: { majorRoute: true }, now })).toBe(70)
    expect(computeImportance({ baseImportance: 45, eventType: 'road_closure', fields: {}, now })).toBe(55)
  })
  it('weather alerts by severity', () => {
    expect(computeImportance({ baseImportance: 40, eventType: 'weather_alert', fields: { severity: 'Extreme' }, now })).toBe(85)
    expect(computeImportance({ baseImportance: 40, eventType: 'weather_alert', fields: { severity: 'Minor' }, now })).toBe(45)
  })
  it('AQI over 100, capped at +30', () => {
    expect(computeImportance({ baseImportance: 40, eventType: 'air_quality', fields: { aqi: 160 }, now })).toBe(52) // +12
    expect(computeImportance({ baseImportance: 40, eventType: 'air_quality', fields: { aqi: 400 }, now })).toBe(70) // capped +30
  })
  it('adds urgency (+10 within 2h) and novelty (+10)', () => {
    const startedAt = new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 min ago
    expect(computeImportance({ baseImportance: 30, eventType: 'road_closure', fields: {}, startedAt, isNovel: true, now })).toBe(60) // 30+10+10+10
  })
  it('clamps to 0–100', () => {
    expect(computeImportance({ baseImportance: 90, eventType: 'weather_alert', fields: { severity: 'Extreme' }, isNovel: true, now })).toBe(100)
  })
})
