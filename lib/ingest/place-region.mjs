// Single source of truth for the country/place → region map, shared by the
// TypeScript pipeline (lib/ingest/geo.ts) and the plain-node live verifier
// (scripts/live-qc-content-checks.mjs), which can't import TS. Plain ESM so both
// can consume it. Region values are the buckets the system tags + groups by;
// US places map to null (domestic). See geo.ts for the reconcile logic.

/** @type {Record<string, string|null>} */
export const PLACE_REGION = {
  // ── United States (domestic → null) ─────────────────────────────────────
  // bare 'america'/'american' omitted — they false-match "South America".
  'united states': null, 'u.s.': null, 'us': null, 'usa': null,
  'washington': null, 'white house': null, 'pentagon': null, 'congress': null, 'california': null,
  'texas': null, 'florida': null, 'new york': null, 'washington state': null, 'yakima': null,
  'chicago': null, 'los angeles': null, 'kansas city': null, 'missouri': null,

  // ── Middle East ─────────────────────────────────────────────────────────
  'israel': 'Middle East', 'israeli': 'Middle East', 'gaza': 'Middle East', 'palestine': 'Middle East',
  'palestinian': 'Middle East', 'west bank': 'Middle East', 'lebanon': 'Middle East', 'lebanese': 'Middle East',
  'beirut': 'Middle East', 'sidon': 'Middle East', 'nabatieh': 'Middle East', 'iran': 'Middle East',
  'iranian': 'Middle East', 'tehran': 'Middle East', 'iraq': 'Middle East', 'syria': 'Middle East',
  'syrian': 'Middle East', 'yemen': 'Middle East', 'houthi': 'Middle East', 'saudi arabia': 'Middle East',
  'saudi': 'Middle East', 'egypt': 'Middle East', 'turkey': 'Middle East', 'turkish': 'Middle East',
  'jordan': 'Middle East', 'qatar': 'Middle East', 'uae': 'Middle East', 'dubai': 'Middle East',
  'hezbollah': 'Middle East', 'hamas': 'Middle East', 'strait of hormuz': 'Middle East', 'hormuz': 'Middle East',
  'kuwait': 'Middle East', 'kuwaiti': 'Middle East', 'bahrain': 'Middle East', 'bahraini': 'Middle East',
  'oman': 'Middle East', 'omani': 'Middle East', 'egyptian': 'Middle East', 'iraqi': 'Middle East',
  'yemeni': 'Middle East', 'jordanian': 'Middle East', 'qatari': 'Middle East', 'kurds': 'Middle East', 'kurdish': 'Middle East',
  'baghdad': 'Middle East', 'damascus': 'Middle East', 'cairo': 'Middle East', 'istanbul': 'Middle East',
  'ankara': 'Middle East', 'riyadh': 'Middle East', 'doha': 'Middle East',

  // ── Europe (incl. Russia/Eurasia by taxonomy choice) ────────────────────
  'united kingdom': 'Europe', 'uk': 'Europe', 'britain': 'Europe', 'british': 'Europe', 'england': 'Europe',
  'scotland': 'Europe', 'wales': 'Europe', 'london': 'Europe', 'france': 'Europe', 'french': 'Europe',
  'paris': 'Europe', 'germany': 'Europe', 'german': 'Europe', 'berlin': 'Europe', 'italy': 'Europe',
  'spain': 'Europe', 'poland': 'Europe', 'ukraine': 'Europe', 'ukrainian': 'Europe', 'kyiv': 'Europe',
  'russia': 'Europe', 'russian': 'Europe', 'moscow': 'Europe', 'kremlin': 'Europe', 'crimea': 'Europe',
  'netherlands': 'Europe', 'sweden': 'Europe', 'norway': 'Europe', 'belgium': 'Europe', 'greece': 'Europe',
  'ireland': 'Europe', 'portugal': 'Europe', 'switzerland': 'Europe', 'austria': 'Europe',
  // Demonyms for the above (ambiguous common words 'polish'/'danish'/'dutch' omitted).
  'italian': 'Europe', 'spanish': 'Europe', 'greek': 'Europe', 'irish': 'Europe', 'portuguese': 'Europe',
  'swiss': 'Europe', 'austrian': 'Europe', 'belgian': 'Europe', 'swedish': 'Europe', 'norwegian': 'Europe',
  // Balkans / Central & Eastern Europe / Nordics / Baltics — previously missing, all Europe bucket.
  'albania': 'Europe', 'albanian': 'Europe', 'serbia': 'Europe', 'serbian': 'Europe', 'belgrade': 'Europe',
  'kosovo': 'Europe', 'croatia': 'Europe', 'croatian': 'Europe', 'bosnia': 'Europe', 'montenegro': 'Europe',
  'north macedonia': 'Europe', 'macedonia': 'Europe', 'hungary': 'Europe', 'hungarian': 'Europe', 'budapest': 'Europe',
  'romania': 'Europe', 'romanian': 'Europe', 'bucharest': 'Europe', 'bulgaria': 'Europe', 'bulgarian': 'Europe',
  'czech': 'Europe', 'czechia': 'Europe', 'prague': 'Europe', 'slovakia': 'Europe', 'slovenia': 'Europe',
  'finland': 'Europe', 'finnish': 'Europe', 'helsinki': 'Europe', 'denmark': 'Europe', 'copenhagen': 'Europe',
  'iceland': 'Europe', 'icelandic': 'Europe', 'belarus': 'Europe', 'belarusian': 'Europe', 'minsk': 'Europe',
  'moldova': 'Europe', 'estonia': 'Europe', 'latvia': 'Europe', 'lithuania': 'Europe',
  'cyprus': 'Europe', 'malta': 'Europe', 'luxembourg': 'Europe',
  // Capitals of already-listed countries.
  'rome': 'Europe', 'madrid': 'Europe', 'warsaw': 'Europe', 'amsterdam': 'Europe', 'brussels': 'Europe',
  'vienna': 'Europe', 'athens': 'Europe',

  // ── Africa ──────────────────────────────────────────────────────────────
  'congo': 'Africa', 'drc': 'Africa', 'democratic republic of the congo': 'Africa', 'nigeria': 'Africa',
  'kenya': 'Africa', 'ethiopia': 'Africa', 'sudan': 'Africa', 'south africa': 'Africa', 'somalia': 'Africa',
  'ghana': 'Africa', 'uganda': 'Africa', 'zambia': 'Africa', 'zimbabwe': 'Africa', 'mali': 'Africa',
  'libya': 'Africa', 'morocco': 'Africa', 'tunisia': 'Africa', 'algeria': 'Africa', 'rwanda': 'Africa',
  // Demonyms + additional countries (ambiguous 'chad'/'georgia' omitted).
  'nigerian': 'Africa', 'kenyan': 'Africa', 'ethiopian': 'Africa', 'sudanese': 'Africa', 'somali': 'Africa',
  'ghanaian': 'Africa', 'ugandan': 'Africa', 'libyan': 'Africa', 'moroccan': 'Africa', 'tunisian': 'Africa',
  'algerian': 'Africa', 'rwandan': 'Africa', 'zimbabwean': 'Africa', 'zambian': 'Africa',
  'tanzania': 'Africa', 'mozambique': 'Africa', 'angola': 'Africa', 'cameroon': 'Africa', 'senegal': 'Africa',
  'niger': 'Africa', 'botswana': 'Africa', 'namibia': 'Africa', 'malawi': 'Africa', 'south sudan': 'Africa',
  'ivory coast': 'Africa', 'lagos': 'Africa', 'nairobi': 'Africa', 'khartoum': 'Africa', 'kinshasa': 'Africa',

  // ── South Asia ──────────────────────────────────────────────────────────
  'india': 'South Asia', 'indian': 'South Asia', 'pakistan': 'South Asia', 'pakistani': 'South Asia',
  'bangladesh': 'South Asia', 'sri lanka': 'South Asia', 'nepal': 'South Asia', 'afghanistan': 'South Asia',
  'new delhi': 'South Asia', 'delhi': 'South Asia', 'mumbai': 'South Asia', 'kashmir': 'South Asia',
  'bangladeshi': 'South Asia', 'nepali': 'South Asia', 'afghan': 'South Asia', 'sri lankan': 'South Asia',
  'islamabad': 'South Asia', 'dhaka': 'South Asia', 'kabul': 'South Asia', 'karachi': 'South Asia',
  'lahore': 'South Asia', 'bhutan': 'South Asia', 'maldives': 'South Asia',

  // ── East Asia & Pacific buckets the system tags individually ────────────
  'japan': 'Japan', 'japanese': 'Japan', 'tokyo': 'Japan',
  'south korea': 'Korea', 'north korea': 'Korea', 'korea': 'Korea', 'korean': 'Korea', 'seoul': 'Korea', 'pyongyang': 'Korea',
  'australia': 'Australia', 'australian': 'Australia', 'sydney': 'Australia', 'melbourne': 'Australia',
  'new zealand': 'Australia',
}
