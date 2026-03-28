export interface SourceTierResult {
  tier: number | null
  sourceType: string | null
}

// ── Journalist-username lookups (for featured journalists with known handles) ──

// Tier 1: Nonprofit Investigative
const NONPROFIT_JOURNALISTS = new Set([
  'propublica', 'marshall', 'texastribune', 'calmatters', 'frontlinepbs',
])

// Tier 2: OSINT
const OSINT_JOURNALISTS = new Set([
  'bellingcat',
])

// Tier 3: Public Broadcaster — journalist handles for DW/Al Jazeera/PBS sub-channels
const PUBLIC_BROADCASTER_JOURNALISTS = new Set([
  'dwplaneta', 'dwdocumentary', 'dwnews', 'dwenglish',
  'aljazeeraenglish', 'aljazeera',
  'pbsnewshour', 'frontlinepbs',
  'france24english', 'france24',
  'nhkworldjapan', 'nhkworld',
  'arirangnews', 'trtworld', 'wion',
])

// Tier 4: Independent News Organization
const INDEPENDENT_NEWS_JOURNALISTS = new Set([
  'theintercept', 'bureau', 'dropsitenews', 'vicenews', 'moreperfectunion',
])

// Tier 6: Commercial / Explainer
const COMMERCIAL_JOURNALISTS = new Set([
  'vox', 'journeymanpictures',
])

// Tier 7: Independent Commentary
const COMMENTARY_JOURNALISTS = new Set([
  'breakingpoints', 'caspianreport', 'polymatter', 'johnnyharris',
  'kylescanlon', 'michaeltracey', 'tarapalmeri', 'wendoverproductions',
  'veritasium', 'audittheaudit',
])

// ── Source-string lookups (for YouTube search results with no journalist username) ──

// Tier 1: Nonprofit — exact source match
const NONPROFIT_SOURCES = new Set([
  'YouTube/ProPublica',
  'YouTube/Frontline PBS',
  'YouTube/The Marshall Project',
  'YouTube/Texas Tribune',
])

// Tier 3: Public Broadcaster — prefix match handles all sub-channels (DW Planet A, DW Documentary, etc.)
const PUBLIC_BROADCASTER_PREFIXES = [
  'YouTube/DW',
  'YouTube/Al Jazeera',
  'YouTube/France 24',
  'YouTube/NHK',
  'YouTube/TRT ',
  'YouTube/Arirang',
  'YouTube/WION',
  'YouTube/ABC News Australia',
  'YouTube/PBS NewsHour',
  'YouTube/PBS Frontline',
]

// Tier 4: Independent News Org
const INDEPENDENT_NEWS_SOURCES = new Set([
  'YouTube/More Perfect Union',
  'YouTube/The Intercept',
  'YouTube/Drop Site News',
  'YouTube/The Bureau of Investigative Journalism',
])

// Tier 5: Wire Service
const WIRE_SERVICE_SOURCES = new Set([
  'YouTube/Reuters', 'YouTube/Associated Press', 'YouTube/AP',
])

// Tier 7: Independent Commentary
const COMMENTARY_SOURCES = new Set([
  'YouTube/Breaking Points',
  'YouTube/Breaking Points with Krystal and Sacha',
  'YouTube/Audit the Audit',
  'YouTube/Caspian Report',
  'YouTube/PolyMatter',
  'YouTube/Johnny Harris',
  'YouTube/Wendover Productions',
  'YouTube/Veritasium',
  'YouTube/Kyle Scanlon',
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

  // ── Journalist-username checks (highest confidence — manually curated) ──
  if (OSINT_JOURNALISTS.has(u))
    return { tier: 2, sourceType: 'OSINT' }

  if (NONPROFIT_JOURNALISTS.has(u))
    return { tier: 1, sourceType: 'Nonprofit Investigative' }

  if (PUBLIC_BROADCASTER_JOURNALISTS.has(u))
    return { tier: 3, sourceType: 'Public Broadcaster' }

  if (INDEPENDENT_NEWS_JOURNALISTS.has(u))
    return { tier: 4, sourceType: 'Independent News' }

  if (COMMERCIAL_JOURNALISTS.has(u))
    return { tier: 6, sourceType: 'Commercial / Explainer' }

  if (COMMENTARY_JOURNALISTS.has(u))
    return { tier: 7, sourceType: 'Independent Commentary' }

  // Any other known journalist handle → Independent Commentary by default
  if (journalistUsername)
    return { tier: 7, sourceType: 'Independent Commentary' }

  // ── Source-string checks (for channels that arrive via search with no journalist_username) ──
  if (NONPROFIT_SOURCES.has(source))
    return { tier: 1, sourceType: 'Nonprofit Investigative' }

  if (PUBLIC_BROADCASTER_PREFIXES.some(p => source.startsWith(p)))
    return { tier: 3, sourceType: 'Public Broadcaster' }

  if (INDEPENDENT_NEWS_SOURCES.has(source))
    return { tier: 4, sourceType: 'Independent News' }

  if (WIRE_SERVICE_SOURCES.has(source))
    return { tier: 5, sourceType: 'Wire Service' }

  if (COMMENTARY_SOURCES.has(source))
    return { tier: 7, sourceType: 'Independent Commentary' }

  if (STATE_MEDIA_SOURCES.has(source))
    return { tier: 8, sourceType: 'State Media' }

  if (category === 'raw' || RAW_FOOTAGE_SUBREDDITS.has(source))
    return { tier: 9, sourceType: 'Raw Footage' }

  // Reddit communities — the only legitimate Tier 10 "Community Sourced"
  if (source.startsWith('r/'))
    return { tier: 10, sourceType: 'Community Sourced' }

  // Unrecognized YouTube/other source — no badge rather than mislabeling
  return { tier: null, sourceType: null }
}
