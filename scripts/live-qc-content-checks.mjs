// Live QC content checks (spec Section 2).
//
// Ten checks run against the rendered live edition, each mapped to a real
// 2026-06-16/17 production defect. Hard findings turn the verifier run red;
// warnings are printed but don't fail it. Text-pattern checks run on the raw
// HTML/text; structured checks consume extractCards() and degrade gracefully
// (return nothing) when card structure can't be recovered.
//
// runContentChecks(html, text, path) -> { failures: Finding[], warnings: Finding[] }
//   Finding = { id, name, severity: 'hard'|'warning', snippets: string[] }

import { PLACE_REGION } from '../lib/ingest/place-region.mjs'

const MSM_TOTAL = 15 // configured MSM list length (lib/ingest/msm-check.ts)

// Canonical region tags (lib/ingest/global.ts buckets). Check #11 detects the
// region LABEL rendered on a card and compares it to the places named in the
// card text. The place→region map is shared from place-region.mjs (single source).
const CANONICAL_REGIONS = ['Middle East', 'Europe', 'Africa', 'South Asia', 'Japan', 'Korea', 'Australia']

function regionTagsInText(text) {
  const found = new Set()
  for (const r of CANONICAL_REGIONS) {
    if (new RegExp(`(^|[^A-Za-z])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`).test(text)) found.add(r)
  }
  return found
}

function namedPlaceRegions(text) {
  const hay = ` ${text.toLowerCase()} `
  const regions = new Set()
  for (const token of Object.keys(PLACE_REGION).sort((a, b) => b.length - a.length)) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(hay)) regions.add(PLACE_REGION[token])
  }
  return regions
}

const HIGH_SALIENCE = /\b(shooting|active shooter|gunman|opened fire|stabbing|killed|wounded|fatalities|mass casualt|tornado|hurricane|wildfire|earthquake|flash flood)\b/i

// ── Card extraction (spec 2.2) ──────────────────────────────────────────────
// Prefer a JSON source over HTML scraping; fall back to section-aware HTML
// parsing of the rendered feed. Returns [] gracefully when nothing parses.
export function extractCards(html, _path) {
  // 1. Preferred: embedded JSON (Pages-router __NEXT_DATA__ or a companion
  //    /api/feed.json shape inlined). App-router pages usually lack this, so
  //    this branch is best-effort and silent on miss.
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextData) {
    try {
      const json = JSON.parse(nextData[1])
      const cards = collectCardsFromJson(json)
      if (cards.length) return cards
    } catch {
      // fall through to HTML parsing
    }
  }

  // 2. Fallback: split the rendered text into sections by known headings, then
  //    read each card's coverage/source/confidence from the surrounding text.
  return extractCardsFromHtml(html)
}

const SECTION_HEADINGS = [
  'Need To Know', 'Politics & World Affairs', 'Science, Health & Environment',
  'Business & Markets', 'Culture, Media & Society', 'Also Worth Knowing',
  'Mainstream Pulse', 'Global Blindspot', 'Global Lens',
]

function extractCardsFromHtml(html) {
  const text = stripTags(html)
  // Find section header positions in reading order.
  const marks = []
  for (const heading of SECTION_HEADINGS) {
    const idx = text.indexOf(heading)
    if (idx !== -1) marks.push({ heading, idx })
  }
  marks.sort((a, b) => a.idx - b.idx)
  if (!marks.length) return []

  const cards = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx + marks[i].heading.length
    const end = i + 1 < marks.length ? marks[i + 1].idx : text.length
    const block = text.slice(start, end)
    // One "card" per coverage mention in the section (coverage is the anchor
    // that the structured checks care about). Capture a window around each.
    const covRe = /(\d+)\s+of\s+(\d+)\s+outlets/gi
    let m
    let found = false
    while ((m = covRe.exec(block))) {
      found = true
      const window = block.slice(Math.max(0, m.index - 160), Math.min(block.length, m.index + 80))
      cards.push({
        section: marks[i].heading,
        coverageCount: Number(m[1]),
        coverageTotal: Number(m[2]),
        confidence: matchConfidence(window),
        text: window.trim(),
      })
    }
    if (!found) {
      cards.push({ section: marks[i].heading, coverageCount: null, coverageTotal: null, confidence: matchConfidence(block.slice(0, 240)), text: block.slice(0, 240).trim() })
    }
  }
  return cards
}

function collectCardsFromJson(json) {
  // Walk the JSON for objects that look like digest cards. Intentionally
  // permissive; returns [] if the shape isn't there.
  const out = []
  const visit = (node, section) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(n => visit(n, section)); return }
    const cov = node.msm_outlet_coverage
    if (cov && Array.isArray(cov.covered)) {
      out.push({
        section: section ?? node.section ?? null,
        coverageCount: cov.covered.length,
        coverageTotal: cov.covered.length + (cov.notCovered?.length ?? 0),
        confidence: node.confidence ?? null,
        source: node.source ?? node.journalist_username ?? null,
        text: node.title ?? '',
      })
    }
    for (const [k, v] of Object.entries(node)) visit(v, SECTION_HEADINGS.includes(k) ? k : section)
  }
  visit(json, null)
  return out
}

function matchConfidence(window) {
  const m = window.match(/\b(Corroborated|Reported|Developing|Single-source|Analysis|Satire|Cultural lens)\b/i)
  return m ? m[1] : null
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function finding(id, name, severity, snippets) {
  return { id, name, severity, snippets: snippets.slice(0, 5) }
}

// ── The ten checks ──────────────────────────────────────────────────────────
export function runContentChecks(html, text, path) {
  const failures = []
  const warnings = []
  const cards = extractCards(html, path)
  const push = f => (f.severity === 'hard' ? failures : warnings).push(f)

  // 1. Denominator consistency (HARD): the coverage denominator must equal the
  //    configured MSM list length everywhere in one edition.
  const denoms = [...text.matchAll(/of\s+(\d+)\s+outlets/gi)].map(m => Number(m[1]))
  const distinct = [...new Set(denoms)]
  if (distinct.length > 1) {
    push(finding('denominator_consistency', 'Coverage denominator is inconsistent within the edition', 'hard',
      distinct.map(d => `"of ${d} outlets"`)))
  } else if (distinct.length === 1 && distinct[0] !== MSM_TOTAL) {
    push(finding('denominator_consistency', `Coverage denominator ${distinct[0]} ≠ configured MSM list length ${MSM_TOTAL}`, 'hard',
      [`"of ${distinct[0]} outlets"`]))
  }

  // 2. Duplication artifact (WARNING): doubled word or broken internal caps
  //    ("ABC News Australia aBC Australia").
  const dupWord = snippets(text, /\b(\w{3,})\s+\1\b/i)
  const brokenCaps = snippets(text, /\b[a-z][A-Z]{2,}\w*/)
  if (dupWord.length || brokenCaps.length) {
    push(finding('duplication_artifact', 'Duplicated word / broken-caps rendering artifact', 'warning', [...dupWord, ...brokenCaps]))
  }

  // 3. Promo / social-copy leak (HARD).
  const promo = snippets(text, /\b(check out|subscribe for more|follow me|link in bio|tour tickets?|tour dates?|merch|patreon)\b/i)
  if (promo.length) push(finding('promo_leak', 'Promotional/social copy leaked into a card', 'hard', promo))

  // 4. Date freshness (WARNING): the edition should carry a recent date.
  const dates = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].map(m => m[0])
  if (dates.length) {
    const newest = dates.sort().at(-1)
    const ageDays = (Date.now() - Date.parse(newest)) / 86_400_000
    if (ageDays > 2) push(finding('date_freshness', `Newest date on page is ${newest} (${Math.floor(ageDays)}d old)`, 'warning', [newest]))
  }

  // 5. Card completeness (WARNING, structured): a card with coverage but no
  //    confidence label is incompletely attributed.
  const incomplete = cards.filter(c => c.coverageCount != null && !c.confidence).map(c => `${c.section}: ${c.text}`)
  if (incomplete.length) push(finding('card_completeness', 'Card missing a confidence label', 'warning', incomplete))

  // 6. Blindspot placement (HARD, structured): a Global Blindspot card with more
  //    than 2 covering outlets is not a blindspot ("11 of 14" under Blindspot).
  const misBlind = cards.filter(c => c.section === 'Global Blindspot' && c.coverageCount != null && c.coverageCount > 2)
    .map(c => `${c.coverageCount} of ${c.coverageTotal} outlets under Global Blindspot — ${c.text}`)
  if (misBlind.length) push(finding('blindspot_placement', 'Broadly-covered story placed under Global Blindspot', 'hard', misBlind))

  // 7. Source / attribution match (WARNING): two different known outlets named
  //    in one attribution (e.g. "ABC News Australia" labeled "africanews").
  const attrib = detectAttributionMismatch(text)
  if (attrib.length) push(finding('source_attribution_match', 'Source name and outlet label disagree', 'warning', attrib))

  // 8. Lead eligibility (HARD, structured): the first Need To Know card must not
  //    be commentary/satire/opinion-classed.
  const lead = cards.find(c => c.section === 'Need To Know')
  if (lead && lead.confidence && /\b(Analysis|Satire|Cultural lens|Opinion)\b/i.test(lead.confidence)) {
    push(finding('lead_eligibility', `Lead card is ${lead.confidence}, not reported`, 'hard', [lead.text]))
  }

  // 9. Cross-section duplicate (WARNING, structured): same card text in two
  //    sections.
  const seen = new Map()
  for (const c of cards) {
    const key = c.text.slice(0, 60).toLowerCase()
    if (key.length < 20) continue
    if (seen.has(key) && seen.get(key) !== c.section) {
      warnings.push(finding('cross_section_duplicate', 'Same story appears in two sections', 'warning', [`${seen.get(key)} + ${c.section}: ${c.text}`]))
    }
    seen.set(key, c.section)
  }

  // 10. High-severity suspect coverage (HARD): a 0-of-N card on a mass-casualty
  //     / disaster story — an implausible blindspot used as a prominent slot.
  for (const c of cards) {
    if (c.coverageCount === 0 && HIGH_SALIENCE.test(c.text)) {
      push(finding('high_severity_suspect_coverage', 'High-salience story shown 0-of-N (suspect coverage)', 'hard', [c.text]))
    }
  }

  // 11. Region consistency (HARD): a card's region tag (label) contradicts every
  //     place named in its text — a WION clip about Lebanon tagged "South Asia",
  //     an Al Jazeera clip about Congo tagged "Middle East". Generation (A1)
  //     corrects these at the source; this is the next-morning backstop.
  for (const c of cards) {
    const tags = regionTagsInText(c.text)
    if (tags.size === 0) continue
    const placeRegions = namedPlaceRegions(c.text)
    if (placeRegions.size === 0) continue
    const agrees = [...tags].some(t => placeRegions.has(t))
    if (!agrees) {
      const placesLabel = [...placeRegions].map(r => r ?? 'US/domestic').join(', ')
      push(finding('region_consistency', `Region tag ${[...tags].join('/')} contradicts every named place (text names: ${placesLabel})`, 'hard', [c.text.slice(0, 160)]))
    }
  }

  // 12. Section fit (WARNING): a card reads like governance/regulation but renders
  //     in a Science/Health or Business section (UK under-16 platform ban placed in
  //     Science). Section is fuzzier than region, so warn-only — surfaced every
  //     morning for an editor to sanity-check.
  const GOVERNANCE = /\b(regulat\w+|legislat\w+|\bbans?\b|\bbanned\b|court|ruling|parliament|congress|senate|sanction\w*|election|lawmakers?|government|ministry|treaty|proscri\w+)\b/i
  const MISFIT_SECTIONS = /(Science|Health|Environment|Business|Markets)/i
  for (const c of cards) {
    if (c.section && MISFIT_SECTIONS.test(c.section) && GOVERNANCE.test(c.text)) {
      push(finding('section_fit', `Card in "${c.section}" reads like governance/regulation — verify it shouldn't be Politics & World Affairs`, 'warning', [c.text.slice(0, 160)]))
    }
  }

  return { failures, warnings }
}

function detectAttributionMismatch(text) {
  const OUTLETS = ['abc news australia', 'africanews', 'al jazeera', 'dw news', 'france 24', 'bbc', 'reuters', 'ap', 'wion', 'trt world', 'arirang']
  const out = []
  // Look at ~120-char windows that mention an outlet; if a window names two
  // distinct known outlets, the attribution is internally inconsistent.
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length; i += 100) {
    const window = lower.slice(i, i + 140)
    const named = OUTLETS.filter(o => window.includes(o))
    // "abc news australia" contains no other; "africanews" distinct. Filter
    // substring overlaps (al jazeera vs al jazeera english) by length.
    const distinct = named.filter(o => !named.some(other => other !== o && other.includes(o)))
    if (distinct.length >= 2) out.push(text.slice(i, i + 140).trim())
    if (out.length >= 5) break
  }
  return out
}

function snippets(text, pattern, limit = 5) {
  const matches = []
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let match
  while ((match = regex.exec(text)) && matches.length < limit) {
    const start = Math.max(0, match.index - 60)
    const end = Math.min(text.length, match.index + match[0].length + 60)
    const snippet = text.slice(start, end).trim()
    if (!matches.some(e => e.toLowerCase() === snippet.toLowerCase())) matches.push(snippet)
    if (regex.lastIndex <= match.index) regex.lastIndex = match.index + 1
  }
  return matches
}
