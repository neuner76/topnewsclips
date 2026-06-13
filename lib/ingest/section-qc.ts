// Blocking QC for the major-story page sections (Phase 3). Deterministic
// firewall — mirrors runStaticQCChecks: cheap, no extra LLM call, and it
// strips any section that fails rather than holding the whole story. A bad
// section never publishes; the story publishes without it.

export interface MajorSections {
  inContext: string | null
  whatWeKnow: string[] | null
  whatRemainsUnclear: string[] | null
}

export interface SectionQCInput {
  inContext?: string | null
  whatWeKnow?: string[] | null
  whatRemainsUnclear?: string[] | null
  /** Developing/single-source stories MUST keep a non-empty whatRemainsUnclear. */
  isDeveloping: boolean
}

// A clause carries an attribution if it names a source/actor for its claim.
const ATTRIBUTION_PATTERN = /\b(according to|per |reports?|reported|said|says|stated|told|cited|confirmed|announced|alleged|claimed|officials?|authorities|spokesperson|ministry|department|witnesses?|sources?|study|data|filing|statement|court|judge|ruling)\b/i

// Causal/escalatory connectors that assert a why without naming who says so.
const CAUSAL_PATTERN = /\b(because|due to|as a result|leading to|which caused|driving|fueled by|in retaliation|signals?|underscores?|reveals?|exposes?|proves?|amounts to|escalat\w+)\b/i

// Banned escalatory site-voice words (mirror claude-verify RULE 5).
const BANNED_VOICE = /\b(purge|sweeping|unprecedented|dramatic|lays bare|makes clear)\b/i

function sentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) ?? []
}

// A sentence passes if it either attributes its claim, or makes no causal
// claim at all (a plain attributed-or-neutral fact). A causal claim with no
// attribution fails — that's an unattributed "why" in the site's own voice.
function sentenceOk(sentence: string): boolean {
  if (BANNED_VOICE.test(sentence)) return false
  if (CAUSAL_PATTERN.test(sentence) && !ATTRIBUTION_PATTERN.test(sentence)) return false
  return true
}

function validInContext(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length < 40) return null
  const sents = sentences(trimmed)
  if (sents.length === 0) return null
  // Every sentence must clear the attribution/causal/voice bar
  if (!sents.every(sentenceOk)) return null
  // At least one sentence must actually attribute — guards against a
  // paragraph of bare assertions that happen to dodge the causal pattern.
  if (!sents.some(s => ATTRIBUTION_PATTERN.test(s))) return null
  return trimmed
}

function validList(items: string[] | null | undefined, opts: { requireAttribution: boolean }): string[] | null {
  if (!Array.isArray(items)) return null
  const clean = items
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.trim())
    .filter(s => !BANNED_VOICE.test(s))
    .filter(s => opts.requireAttribution ? ATTRIBUTION_PATTERN.test(s) : true)
    .filter(s => !(CAUSAL_PATTERN.test(s) && !ATTRIBUTION_PATTERN.test(s)))
  return clean.length > 0 ? clean : null
}

// Runs the blocking section QC. Returns the sections that passed (failed ones
// are null) plus the list of dropped section names for logging.
export function runSectionQC(input: SectionQCInput): { sections: MajorSections; dropped: string[] } {
  const dropped: string[] = []

  const inContext = validInContext(input.inContext)
  if (input.inContext && !inContext) dropped.push('inContext')

  // "What we know" = corroborated facts → attribution required.
  const whatWeKnow = validList(input.whatWeKnow, { requireAttribution: true })
  if (input.whatWeKnow && !whatWeKnow) dropped.push('whatWeKnow')

  // "What remains unclear" = open questions → attribution not required, but
  // for a developing story it must be non-empty or the section fails.
  let whatRemainsUnclear = validList(input.whatRemainsUnclear, { requireAttribution: false })
  if (input.isDeveloping && !whatRemainsUnclear) {
    // Required-but-missing: this is a section QC failure, logged distinctly.
    dropped.push('whatRemainsUnclear(required)')
    whatRemainsUnclear = null
  } else if (input.whatRemainsUnclear && !whatRemainsUnclear) {
    dropped.push('whatRemainsUnclear')
  }

  return { sections: { inContext, whatWeKnow, whatRemainsUnclear }, dropped }
}
