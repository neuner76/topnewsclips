// Hard Need-To-Know freshness gate (deterministic — does not rely on the LLM's
// C4 judgment, which fires unreliably). Rule: a Need To Know card whose newest
// referenced event is older than 72h must carry a fresh-development signal — a
// date within the window, or a today-class marker ("today", "overnight", "just
// reported") — otherwise it is stale and excluded from Need To Know. Global
// Blindspot is exempt; the caller applies this only to the Need To Know list.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const MONTH_ALT = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'

// "today", "overnight", "hours ago", "just reported" etc. — an explicit signal
// the story is anchored to the present. Deliberately excludes "this week"
// (can be up to 7 days old).
const FRESH_MARKER =
  /\b(today|this\s+morning|this\s+afternoon|this\s+evening|tonight|overnight|hours?\s+ago|just\s+(?:announced|reported|confirmed|said|broke)|breaking(?:\s+news)?)\b/i

// Unambiguously-stale relative phrasing (always > 72h).
const STALE_PHRASE =
  /\b(weeks?\s+ago|months?\s+ago|last\s+(?:week|month|year)|(?:more\s+than|over)\s+a\s+week\s+ago)\b/i

function toDate(month: number, day: number, year: number | undefined, edition: Date): Date | null {
  if (day < 1 || day > 31) return null
  const y = year ?? edition.getUTCFullYear()
  let d = new Date(Date.UTC(y, month, day, 12, 0, 0))
  // Year omitted and the date lands in the future → it's from last year.
  if (year === undefined && d.getTime() > edition.getTime() + 7 * 864e5) {
    d = new Date(Date.UTC(y - 1, month, day, 12, 0, 0))
  }
  return isNaN(d.getTime()) ? null : d
}

function extractDates(text: string, edition: Date): Date[] {
  const dates: Date[] = []
  const monthDay = new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi')
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})(?:,?\\s+(\\d{4}))?\\b`, 'gi')
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = monthDay.exec(text))) {
    const d = toDate(MONTHS[m[1].slice(0, 3).toLowerCase()], parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : undefined, edition)
    if (d) dates.push(d)
  }
  while ((m = dayMonth.exec(text))) {
    const d = toDate(MONTHS[m[2].slice(0, 3).toLowerCase()], parseInt(m[1], 10), m[3] ? parseInt(m[3], 10) : undefined, edition)
    if (d) dates.push(d)
  }
  while ((m = iso.exec(text))) {
    const d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0))
    if (!isNaN(d.getTime())) dates.push(d)
  }
  // Ignore implausibly-future dates (parse noise).
  return dates.filter(d => d.getTime() <= edition.getTime() + 7 * 864e5)
}

export interface FreshnessResult {
  fresh: boolean
  reason?: string
}

export function needToKnowFreshness(text: string, edition: Date, maxAgeHours = 72): FreshnessResult {
  // An explicit present-tense signal always keeps the card.
  if (FRESH_MARKER.test(text)) return { fresh: true }

  const cutoff = edition.getTime() - maxAgeHours * 3600_000
  const dates = extractDates(text, edition)

  if (dates.length > 0) {
    const newest = Math.max(...dates.map(d => d.getTime()))
    if (newest >= cutoff) return { fresh: true } // a within-window date IS the fresh timestamp
    const iso = new Date(newest).toISOString().slice(0, 10)
    return { fresh: false, reason: `newest referenced event (${iso}) is older than ${maxAgeHours}h with no fresh-development signal` }
  }

  if (STALE_PHRASE.test(text)) {
    return { fresh: false, reason: 'retrospective framing (e.g. "weeks ago") with no fresh-development signal' }
  }

  // No dates and no stale phrasing — can't prove staleness; keep it.
  return { fresh: true }
}
