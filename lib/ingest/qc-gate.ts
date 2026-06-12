import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

export type QCContentType = 'reported' | 'analysis' | 'satire'
export type QCConfidenceLabel = 'Corroborated' | 'Reported' | 'Analysis' | 'Single-source' | 'Satire' | 'Developing'
export type QCVerdict = 'PASS' | 'FIX' | 'HOLD'

export interface QCInput {
  storyId: string
  section: string
  contentType: QCContentType
  confidenceLabel: QCConfidenceLabel
  headline: string
  summary: string
  sourceName: string
  sourceTier: number | null
  videoPublishDate: string | null
  eventDateEstimate?: string | null
  coverageCount: number
  rawSourceDescription: string
  /** True when headline/summary are a revision from a prior FIX verdict. */
  isRevision?: boolean
}

export interface QCCheckResult {
  id: string
  result: 'pass' | 'fail'
  reason: string
}

export interface QCGateResult {
  storyId: string
  verdict: QCVerdict
  checks: QCCheckResult[]
  revisedHeadline: string | null
  revisedSummary: string | null
  routingNote: string | null
}

const QC_CHECK_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']

let cachedRubric: string | null = null

function loadRubric(): string {
  if (cachedRubric) return cachedRubric
  const rubricPath = path.join(process.cwd(), 'lib', 'ingest', 'rubric.md')
  cachedRubric = fs.readFileSync(rubricPath, 'utf-8')
  return cachedRubric
}

// Remove unpaired Unicode surrogates that cause JSON parse failures
function sanitize(s: string): string {
  return s.replace(/[\uD800-\uDFFF]/g, '')
}

// Static portion of the prompt (rubric + instructions + schema) — identical on
// every call, so it's sent as a separate cache_control block to get the ~90%
// prompt-caching discount on these input tokens.
function buildStaticPrompt(rubric: string): string {
  return `You are the pre-publish editorial QC gate for Top News Clips, a news digest
whose entire brand is precision and sourcing transparency.

Calibration — severity differs by check:
- Trust-critical checks (C1 promo/junk, C2 unnamed principals, C4 freshness
  honesty, C6 confidence-label consistency): be strict. When uncertain, fail —
  a false PASS here costs the brand.
- Copy-quality checks (C3 precision, C5 attribution, C7 alignment, C8 tone):
  fail only for clear violations a reasonable editor would insist on changing
  before publication. Borderline judgment calls, mild hedging, or a single
  closing sentence of modest background context are a pass. If the copy was
  already revised once, do not fail it again for new stylistic nits — only
  for clear violations that remain.

You will receive story metadata and the draft headline/summary. Evaluate
checks C1-C8 per the rubric below.

RUBRIC:
${rubric}

Notes:
- "current_date" (provided with the story data) is today. Compare
  event_date_estimate against current_date for the C4 72-hour freshness
  window — do not treat 2026 dates as "future" or implausible just because
  they postdate your training data.
- event_date_estimate is the date this content was discovered/queued by our
  system, used as a freshness proxy when the underlying video's publish date
  is unknown. If event_date_estimate is within 72 hours of current_date and
  nothing in the summary/source indicates retrospective/archival framing,
  C4 passes.
- coverage_count is a pre-computed count of independently corroborating
  outlets, already verified by our system. Trust it as given — do not fail
  C6 merely because outlet names aren't enumerated in the story data.
- The numeric C6 thresholds (label vs. source_tier/coverage_count) are
  verified deterministically by the system before your output is used.
  For C6, only evaluate non-numeric label problems (e.g. an "Analysis"
  label on straight fact reporting); otherwise report C6 as pass.
- raw_source_description is reference only — fact-check the summary against
  it, but it is never published verbatim, so its own promo links/hashtags/CTAs
  do NOT count as a C1 fail; only flag C1 if that junk appears in the
  headline/summary.

Respond ONLY with JSON matching this schema:
{
  "story_id": string,
  "verdict": "PASS" | "FIX" | "HOLD",
  "checks": [
    {"id": "C1", "result": "pass" | "fail", "reason": string}
  ],
  "revised_headline": string | null,
  "revised_summary": string | null,
  "routing_note": string | null
}

Rules:
- Run all checks C1-C8 and include all eight in "checks".
- "result" must match the conclusion stated in "reason" in EITHER direction.
  If you reconsider mid-explanation and conclude a check actually passes
  (e.g. "this is a pass", "label is correct", "no fail"), set "result" to
  "pass" — never leave "result" as "fail" after your own reasoning concludes
  pass. Conversely, if your reasoning concludes the check actually fails
  (e.g. "the label must be changed," "this does not meet the threshold,"
  "this is incorrect"), set "result" to "fail" — never leave "result" as
  "pass" after your own reasoning concludes fail, even if a fix for it is
  already captured elsewhere (another check's revision, or routing_note). Do
  not show a "wait, re-evaluating" back-and-forth in "reason"; reason once to
  a final conclusion and report that conclusion in both fields.
- Any blocking check (C1-C4) fail that cannot be fixed by rewriting -> HOLD.
- C3 precision failures are usually fixable by deleting filler or replacing
  vague wording with concrete facts already present in the story data. If C3
  is the only blocking failure and you can fix it by rewriting only the
  headline/summary, verdict MUST be "FIX" with revised fields, not "HOLD".
- C5 and C7 failures are revise-level checks. If the source data supports the
  corrected wording, verdict MUST be "FIX" with revised fields, not "HOLD".
- A C2 fail where the name exists in the source -> FIX with the name inserted.
- A C4 fail -> FIX summary framing AND set routing_note to move/drop the card.
- Never invent facts in a revision. If a fix requires information you don't
  have, verdict is HOLD.
- "revised_headline"/"revised_summary" are only set when verdict is "FIX" and the
  issue is fixable by rewriting using only information already present in the
  story data.`
}

// Dynamic portion — changes per story, sent as a second (uncached) content block.
function buildStoryDataPrompt(input: QCInput): string {
  return `STORY DATA:
current_date: ${new Date().toISOString().slice(0, 10)}
story_id: ${input.storyId}
section: ${input.section}
content_type: ${input.contentType}
confidence_label: ${input.confidenceLabel}
headline: ${sanitize(input.headline)}
summary: ${sanitize(input.summary)}
source_name: ${input.sourceName}
source_tier: ${input.sourceTier ?? 'unknown'}
video_publish_date: ${input.videoPublishDate ?? 'unknown'}
event_date_estimate: ${input.eventDateEstimate ?? 'unknown'}
coverage_count: ${input.coverageCount}
already_revised: ${input.isRevision ? 'yes — this copy is a revision from a prior FIX; only fail remaining clear violations, not new stylistic nits' : 'no'}
raw_source_description:
${sanitize(input.rawSourceDescription).slice(0, 600)}`
}

function holdFallback(storyId: string, reason: string): QCGateResult {
  return {
    storyId,
    verdict: 'HOLD',
    checks: [{ id: 'C0', result: 'fail', reason }],
    revisedHeadline: null,
    revisedSummary: null,
    routingNote: null,
  }
}

function sentenceContaining(text: string, pattern: RegExp): string | null {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  return sentences.find(sentence => pattern.test(sentence))?.trim() ?? null
}

function namedPresidentInSource(raw: string): string | null {
  const names = [
    'Joe Biden',
    'Donald Trump',
    'Barack Obama',
    'George W. Bush',
    'Bill Clinton',
    'George H. W. Bush',
    'Jimmy Carter',
  ]
  return names.find(name => new RegExp(`\\b${name.replace(/\./g, '\\.')}\\b`, 'i').test(raw)) ?? null
}

export function runStaticQCChecks(input: QCInput): QCCheckResult[] {
  const publishedText = `${input.headline}\n${input.summary}`
  const rawText = input.rawSourceDescription ?? ''
  const checks: QCCheckResult[] = []

  const promoPattern = /\b(check out|subscribe|follow me|hit me on|link in bio|tour tickets?|tour dates?|merch|patreon|joshjohnsoncomedy\.com|@[a-z0-9_]{3,})\b|#[\w-]+/i
  const promoSentence = sentenceContaining(publishedText, promoPattern)
  if (promoSentence) {
    checks.push({
      id: 'C1',
      result: 'fail',
      reason: `Published copy appears to include source promo/social text: "${promoSentence.slice(0, 160)}"`,
    })
  }

  const unnamedPrincipalPattern = /\b(a|the)\s+former\s+(?:u\.s\.\s+)?president\b/i
  const presidentName = namedPresidentInSource(rawText)
  if (unnamedPrincipalPattern.test(publishedText) && presidentName) {
    checks.push({
      id: 'C2',
      result: 'fail',
      reason: `Published copy says "former U.S. president" even though the source names ${presidentName}.`,
    })
  }

  const mushPattern = /\b(under these circumstances|in this way|reportedly significant|raises questions|sparks concerns|critics say|some say|many believe|in a notable development)\b/i
  const mushSentence = sentenceContaining(input.summary, mushPattern)
  if (mushSentence) {
    checks.push({
      id: 'C3',
      result: 'fail',
      reason: `Summary contains vague filler instead of a concrete fact: "${mushSentence.slice(0, 160)}"`,
    })
  }

  const retrospectivePattern = /\b(retrospective|from the archives?|archive documentary|documentary|anniversary|looking back|history of)\b/i
  const dailySectionPattern = /\b(need to know|politics|world|daily|global lens|global blindspot|reported)\b/i
  const retrospectiveText = `${rawText}\n${publishedText}`
  if (retrospectivePattern.test(retrospectiveText) && dailySectionPattern.test(input.section)) {
    checks.push({
      id: 'C4',
      result: 'fail',
      reason: 'Story appears to be archival/retrospective content in a daily news section.',
    })
  }

  // C6 is arithmetic over (label, source_tier, coverage_count) — checked
  // deterministically rather than left to the model. Only overstatement
  // fails; a conservative label is never a trust problem.
  const tier = input.sourceTier
  const coverage = input.coverageCount
  if (input.confidenceLabel === 'Corroborated') {
    const meetsThreshold = coverage >= 5 || (coverage >= 3 && tier !== null && tier <= 5)
    if (!meetsThreshold) {
      checks.push({
        id: 'C6',
        result: 'fail',
        reason: `"Corroborated" requires 5+ outlets, or 3+ with a Tier 1-5 source; coverage_count is ${coverage} (tier ${tier ?? 'unknown'}). Correct label is ${tier !== null && tier <= 6 ? '"Reported"' : coverage >= 2 ? '"Developing"' : '"Single-source"'}.`,
      })
    }
  } else if (input.confidenceLabel === 'Reported' && tier !== null && tier >= 7) {
    checks.push({
      id: 'C6',
      result: 'fail',
      reason: `"Reported" requires an institutional Tier 1-6 source; source_tier is ${tier}. Correct label is ${coverage >= 2 ? '"Developing"' : '"Single-source"'}.`,
    })
  } else if (input.confidenceLabel === 'Developing' && tier !== null && tier >= 7 && coverage < 2) {
    checks.push({
      id: 'C6',
      result: 'fail',
      reason: `"Developing" requires 2+ covering outlets for a Tier 7-10 source; coverage_count is ${coverage}. Correct label is "Single-source".`,
    })
  }

  return checks
}

function mergeStaticChecks(checks: QCCheckResult[], staticFailures: QCCheckResult[]): QCCheckResult[] {
  if (!staticFailures.length) return checks
  const byId = new Map<string, QCCheckResult>()
  for (const check of checks) byId.set(check.id, check)
  for (const check of staticFailures) byId.set(check.id, check)

  return QC_CHECK_IDS
    .map(id => byId.get(id))
    .filter((check): check is QCCheckResult => !!check)
}

function normalizeCheckResult(check: QCCheckResult): QCCheckResult {
  if (
    check.result === 'fail' &&
    /\b(this is a pass|is a pass|label is correct|correct label|no fail|not a fail|squarely fits)\b/i.test(check.reason)
  ) {
    return { ...check, result: 'pass' }
  }
  return check
}

function normalizeVerdict(
  verdict: QCVerdict,
  checks: QCCheckResult[],
  revisedHeadline: string | null,
  revisedSummary: string | null,
): QCVerdict {
  const failedIds = checks.filter(c => c.result === 'fail').map(c => c.id)
  if (failedIds.length === 0) return 'PASS'
  const fixableIds = new Set(['C3', 'C5', 'C7', 'C8'])
  const hasRevision = !!(revisedHeadline || revisedSummary)
  if (verdict === 'HOLD' && hasRevision && failedIds.every(id => fixableIds.has(id))) {
    return 'FIX'
  }
  return verdict
}

export async function runQCGate(input: QCInput, apiKey: string): Promise<QCGateResult> {
  const rubric = loadRubric()
  const staticPrompt = buildStaticPrompt(rubric)
  const storyDataPrompt = buildStoryDataPrompt(input)
  const client = new Anthropic({ apiKey })
  const staticFailures = runStaticQCChecks(input)

  let raw: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: storyDataPrompt },
        ],
      }],
    })
    raw = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (err) {
    return holdFallback(input.storyId, `QC gate request failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const text = jsonMatch ? jsonMatch[0] : stripped

  try {
    const parsed = JSON.parse(text) as {
      story_id: string
      verdict: QCVerdict
      checks: QCCheckResult[]
      revised_headline: string | null
      revised_summary: string | null
      routing_note: string | null
    }
    // Normalize the model's checks (self-contradictory reasoning) BEFORE
    // merging — static failures are deterministic and must never be
    // reinterpreted by the reason-text heuristic.
    const checks = mergeStaticChecks((parsed.checks ?? []).map(normalizeCheckResult), staticFailures)
    const parsedVerdict = parsed.verdict === 'PASS' && staticFailures.length > 0 ? 'HOLD' : parsed.verdict
    const verdict = normalizeVerdict(
      parsedVerdict,
      checks,
      parsed.revised_headline ?? null,
      parsed.revised_summary ?? null,
    )
    return {
      storyId: parsed.story_id ?? input.storyId,
      verdict,
      checks,
      revisedHeadline: parsed.revised_headline ?? null,
      revisedSummary: parsed.revised_summary ?? null,
      routingNote: parsed.routing_note ?? null,
    }
  } catch {
    return holdFallback(input.storyId, 'Failed to parse QC gate response')
  }
}
