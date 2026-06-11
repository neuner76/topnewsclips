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
whose entire brand is precision and sourcing transparency. You are strict.
When uncertain, fail the check — a false HOLD costs minutes; a false PASS
costs the brand.

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
- Any blocking check (C1-C4) fail that cannot be fixed by rewriting -> HOLD.
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

export async function runQCGate(input: QCInput, apiKey: string): Promise<QCGateResult> {
  const rubric = loadRubric()
  const staticPrompt = buildStaticPrompt(rubric)
  const storyDataPrompt = buildStoryDataPrompt(input)
  const client = new Anthropic({ apiKey })

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
    return {
      storyId: parsed.story_id ?? input.storyId,
      verdict: parsed.verdict,
      checks: parsed.checks ?? [],
      revisedHeadline: parsed.revised_headline ?? null,
      revisedSummary: parsed.revised_summary ?? null,
      routingNote: parsed.routing_note ?? null,
    }
  } catch {
    return holdFallback(input.storyId, 'Failed to parse QC gate response')
  }
}
