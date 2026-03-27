export interface SourceTierResult {
  tier: number
  sourceType: string
}

// Tier 1: Nonprofit Investigative
const NONPROFIT_JOURNALISTS = new Set([
  'propublica', 'marshall', 'texastribune', 'calmatters', 'frontlinepbs',
])

// Tier 2: OSINT
const OSINT_JOURNALISTS = new Set([
  'bellingcat',
])

// Tier 3: Public Broadcaster
const PUBLIC_BROADCASTER_SOURCES = new Set([
  'YouTube/Al Jazeera English',
  'YouTube/DW News',
  'YouTube/France 24 English',
  'YouTube/NHK World News',
  'YouTube/Arirang News',
  'YouTube/ABC News Australia',
])

// Tier 4: Independent News Organization
const INDEPENDENT_NEWS_JOURNALISTS = new Set([
  'theintercept', 'bureau', 'dropsitenews', 'vicenews',
])

// Tier 5: Wire Service
const WIRE_SERVICE_SOURCES = new Set([
  'YouTube/Reuters', 'YouTube/Associated Press', 'YouTube/AP',
])

// Tier 6: Commercial / Explainer
const COMMERCIAL_JOURNALISTS = new Set([
  'vox', 'journeymanpictures',
])

// Tier 7: Independent Commentary
const COMMENTARY_JOURNALISTS = new Set([
  'breakingpoints', 'caspianreport', 'polymatter', 'johnnyharis',
  'kylescanlon', 'michaeltracey', 'tarapalmeri', 'wendoverproductions',
  'veritasium',
])

// Tier 8: State Media
const STATE_MEDIA_SOURCES = new Set([
  'YouTube/CGTN', 'YouTube/TeleSUR English',
])

// Raw footage subreddits
const RAW_FOOTAGE_SUBREDDITS = new Set([
  'r/bodycam', 'r/CaughtOnCamera', 'r/Roadcam', 'r/Dashcam',
])

export function getSourceTier(
  journalistUsername: string | null,
  source: string,
  category: string | null,
): SourceTierResult {
  const u = journalistUsername?.toLowerCase() ?? ''

  if (OSINT_JOURNALISTS.has(u))
    return { tier: 2, sourceType: 'OSINT' }

  if (NONPROFIT_JOURNALISTS.has(u))
    return { tier: 1, sourceType: 'Nonprofit Investigative' }

  if (INDEPENDENT_NEWS_JOURNALISTS.has(u))
    return { tier: 4, sourceType: 'Independent News' }

  if (COMMERCIAL_JOURNALISTS.has(u))
    return { tier: 6, sourceType: 'Commercial / Explainer' }

  if (COMMENTARY_JOURNALISTS.has(u))
    return { tier: 7, sourceType: 'Independent Commentary' }

  if (journalistUsername)
    return { tier: 7, sourceType: 'Independent Commentary' }

  if (PUBLIC_BROADCASTER_SOURCES.has(source))
    return { tier: 3, sourceType: 'Public Broadcaster' }

  if (WIRE_SERVICE_SOURCES.has(source))
    return { tier: 5, sourceType: 'Wire Service' }

  if (STATE_MEDIA_SOURCES.has(source))
    return { tier: 8, sourceType: 'State Media' }

  if (category === 'raw' || RAW_FOOTAGE_SUBREDDITS.has(source))
    return { tier: 9, sourceType: 'Raw Footage' }

  if (source.startsWith('r/'))
    return { tier: 10, sourceType: 'Community Sourced' }

  return { tier: 10, sourceType: 'Community Sourced' }
}
