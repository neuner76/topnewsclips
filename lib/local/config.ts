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

// D1 strangler: each section is served 'live' (fetch-on-request) or 'store' (read
// the event store), never both. Defaults are 'live'. Flip a section to 'store'
// WITHOUT a code change by listing its key in LOCAL_STORE_SECTIONS (comma-separated)
// — do this in the deploy env only AFTER the ingest migrations are applied and the
// dispatcher cron has populated that section's events. Unknown keys are ignored.
const DEFAULT_SECTION_SOURCE: Record<LocalSectionKey, SectionSource> = {
  needToKnow: 'live',
  changingAroundYou: 'live',
  yourGovernment: 'live',
  environment: 'live',
  roadsAndIncidents: 'live',
  trafficCameras: 'live',
  localReporting: 'live',
  localBlindspot: 'live',
}

const KEY_SET = new Set<string>(LOCAL_SECTION_KEYS)

function storeSectionsFromEnv(): Set<LocalSectionKey> {
  const raw = process.env.LOCAL_STORE_SECTIONS ?? ''
  const keys = raw.split(',').map(s => s.trim()).filter((k): k is LocalSectionKey => KEY_SET.has(k))
  return new Set(keys)
}

export function sectionSource(key: LocalSectionKey): SectionSource {
  if (storeSectionsFromEnv().has(key)) return 'store'
  return DEFAULT_SECTION_SOURCE[key]
}

// Exposed for tests / debug surfaces.
export const LOCAL_SECTION_SOURCE = DEFAULT_SECTION_SOURCE
