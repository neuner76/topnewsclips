export interface SourceTierResult {
  tier: number | null
  sourceType: string | null
}

// ── Journalist-username lookups (for featured journalists with known handles) ──

// Tier 1: Nonprofit Investigative
// Includes nonprofit newsrooms and nonpartisan research institutions with published methodologies
// (e.g. ProPublica, The Marshall Project, CSIS, RAND)
const NONPROFIT_JOURNALISTS = new Set([
  'propublica', 'marshall', 'texastribune', 'calmatters', 'frontlinepbs',
  'frontline', // FRONTLINE PBS (alternate handle)
  'revealnews', 'icijorg',
  'csis', 'csisonline', // Center for Strategic and International Studies
  'npr', // NPR
])

// Tier 2: OSINT
const OSINT_JOURNALISTS = new Set([
  'bellingcat', 'forensicarchitecture1967',
])

// Tier 3: Public Broadcaster — journalist handles for DW/Al Jazeera/PBS sub-channels
const PUBLIC_BROADCASTER_JOURNALISTS = new Set([
  'dwplaneta', 'dwdocumentary', 'dwnews', 'dwenglish',
  'aljazeeraenglish', 'aljazeera',
  'pbsnewshour', 'frontlinepbs',
  'france24english', 'france24',
  'nhkworldjapan', 'nhkworld',
  'arirangnews', 'trtworld', 'wion',
  'africanews',
  'bbcworldservice', // BBC World Service
  'abcnewsaustralia', // ABC News Australia
  'cbcnews',          // CBC News (Canada)
  'channel4news',     // Channel 4 News (UK)
])

// Tier 4: Independent News Organization
const INDEPENDENT_NEWS_JOURNALISTS = new Set([
  'theintercept', 'investigativejournalismbureau', 'dropsitenews', 'vicenews', 'moreperfectunion',
  'democracynow', 'theguardian',
  'taskandpurpose', // Military news and veteran affairs
])

// Tier 6: Commercial / Explainer
const COMMERCIAL_JOURNALISTS = new Set([
  'vox', 'journeymanpictures',
  // Broadcast network news magazines & cable news
  '60minutes', '2020', 'datelinenbc',
  'cnn', 'bbcnews', 'cnbc',
  'bloombergquicktake',
  'abcnews', 'cbsnews',
])

// Tier 6: Commercial / Explainer (Satire) — institutional backing (Paramount, HBO)
const SATIRE_COMMERCIAL_JOURNALISTS = new Set([
  'thedailyshow',
  'lastweektonight',
])

// Tier 7: Independent Commentary (Satire) — creator-driven
const SATIRE_COMMENTARY_JOURNALISTS = new Set([
  'joshjohnsoncomedy',
  'smn',           // Some More News
  'thejuicemedia', // Honest Government Ads
  'jonathanpie',
])

// Tier 7: Independent Commentary
const COMMENTARY_JOURNALISTS = new Set([
  'breakingpoints', 'caspianreport', 'polymatter', 'johnnyharris', 'perunau',
  'kylescanlon', 'kylascanlon', 'michaeltracey', 'tarapalmeri', 'wendoverproductions',
  'veritasium', 'audittheaudit', 'ggreenwald', 'geohussar', 'iancarrollshow',
  'whitneywebb', 'jamesfreeman', 'undecidedtechnology', 'tanglenews', 'patrickboyleonfinance',
  'drmyriamfrancois1', // Community nominated — accepted 2026-04-04
])

// ── Source-string lookups (for YouTube search results with no journalist username) ──

// Tier 1: Nonprofit — exact source match
const NONPROFIT_SOURCES = new Set([
  'YouTube/ProPublica',
  'YouTube/Frontline PBS',
  'YouTube/The Marshall Project',
  'YouTube/Texas Tribune',
  'YouTube/Reveal',
  'YouTube/ICIJ',
  'YouTube/International Consortium of Investigative Journalists',
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
  'YouTube/Africanews',
]

// Tier 4: Independent News Org
const INDEPENDENT_NEWS_SOURCES = new Set([
  'YouTube/More Perfect Union',
  'YouTube/The Intercept',
  'YouTube/Drop Site News',
  'YouTube/The Bureau of Investigative Journalism',
  'YouTube/Bureau of Investigative Journalism',
  'YouTube/The Guardian',
])

// Tier 5: Wire Service
const WIRE_SERVICE_SOURCES = new Set([
  'YouTube/Reuters', 'YouTube/Associated Press', 'YouTube/AP',
  'YouTube/AP Archive', 'YouTube/News2Share', 'YouTube/Storyful News',
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
  // Satire channels (arrive via search without journalist_username)
  'YouTube/The Daily Show',
  'YouTube/Last Week Tonight with John Oliver',
  'YouTube/Some More News',
  'YouTube/Jonathan Pie',
  'YouTube/Josh Johnson',
  'YouTube/honest government ads',
])

// Tier 8: State Media
const STATE_MEDIA_SOURCES = new Set([
  'YouTube/CGTN', 'YouTube/TeleSUR English',
])

// Tier 5: Wire Service journalists
const WIRE_SERVICE_JOURNALISTS = new Set([
  'news2share', 'storyfulnews', 'aparchive',
  'reuters',        // Reuters
  'afpnewsagency',  // AFP News Agency
])

// Raw footage subreddits
const RAW_FOOTAGE_SUBREDDITS = new Set([
  'r/bodycam', 'r/CaughtOnCamera', 'r/Roadcam', 'r/Dashcam',
])

// Tier 9: Raw footage journalist channels
const RAW_FOOTAGE_JOURNALISTS = new Set([
  'policeactivity', 'weathernation', 'viralhog',
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

  if (WIRE_SERVICE_JOURNALISTS.has(u))
    return { tier: 5, sourceType: 'Wire Service' }

  if (COMMERCIAL_JOURNALISTS.has(u))
    return { tier: 6, sourceType: 'Commercial / Explainer' }

  if (SATIRE_COMMERCIAL_JOURNALISTS.has(u))
    return { tier: 6, sourceType: 'Commercial / Explainer (Satire)' }

  if (SATIRE_COMMENTARY_JOURNALISTS.has(u))
    return { tier: 7, sourceType: 'Independent Commentary (Satire)' }

  if (COMMENTARY_JOURNALISTS.has(u))
    return { tier: 7, sourceType: 'Independent Commentary' }

  if (RAW_FOOTAGE_JOURNALISTS.has(u))
    return { tier: 9, sourceType: 'Raw Footage' }

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

  // TikTok sources — trending hashtag content from unverified creators
  // Raw footage TikToks (bodycam, dashcam) → Tier 9; everything else → Tier 10
  if (source.startsWith('TikTok/')) {
    if (category === 'raw') return { tier: 9, sourceType: 'Raw Footage' }
    return { tier: 10, sourceType: 'Community Sourced' }
  }

  // Unrecognized source — no badge rather than mislabeling
  return { tier: null, sourceType: null }
}
