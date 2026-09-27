// D1 (strangler migration): each /local briefing section is served either by
// LIVE compute (fetch-on-request, the current path) or by reading the stored
// event/observation pipeline — never both. This flag decides, per section. Flip
// a section to 'store' only once its store read is wired; until then it stays
// 'live'. Migration order (D1): Need To Know + Roads → Environment → Local
// Reporting (Ph2) → Changing Around You + Blindspot (Ph3).

export const LOCAL_SECTION_KEYS = [
  'needToKnow',
  'changingAroundYou',
  'yourGovernment',
  'environment',
  'roadsAndIncidents',
  'trafficCameras',
  'localReporting',
  'localBlindspot',
] as const

export type LocalSectionKey = (typeof LOCAL_SECTION_KEYS)[number]
export type SectionSource = 'live' | 'store'

// All sections live-compute today — nothing is in the store yet.
export const LOCAL_SECTION_SOURCE: Record<LocalSectionKey, SectionSource> = {
  needToKnow: 'live',
  changingAroundYou: 'live',
  yourGovernment: 'live',
  environment: 'live',
  roadsAndIncidents: 'live',
  trafficCameras: 'live',
  localReporting: 'live',
  localBlindspot: 'live',
}

export function sectionSource(key: LocalSectionKey): SectionSource {
  return LOCAL_SECTION_SOURCE[key]
}
