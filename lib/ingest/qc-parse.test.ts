import { describe, expect, it } from 'vitest'
import { escapeControlCharsInStrings } from './qc-gate'

// The QC gate does JSON.parse() on the model's raw output. At temperature 0 the
// model deterministically emits multi-paragraph summary/reason fields with
// LITERAL newlines/tabs inside the JSON string values, which JSON.parse rejects
// ("Invalid control character"). This helper escapes control characters that
// occur inside string literals so the object parses, without corrupting valid
// JSON. Regression: commit 070b270 (2026-06-10) made a parse failure a permanent
// HOLD, silently dropping ~30% of ingested stories.
describe('escapeControlCharsInStrings', () => {
  const roundtrip = (s: string) => JSON.parse(escapeControlCharsInStrings(s))

  it('makes a literal newline inside a string value parseable', () => {
    const raw = '{"summary":"Line one.\nLine two."}'
    expect(() => JSON.parse(raw)).toThrow() // baseline: the bug
    expect(roundtrip(raw)).toEqual({ summary: 'Line one.\nLine two.' })
  })

  it('escapes tabs and other control chars inside strings', () => {
    const raw = '{"a":"col1\tcol2","b":"xy"}'
    expect(roundtrip(raw)).toEqual({ a: 'col1\tcol2', b: 'xy' })
  })

  it('leaves already-escaped sequences intact (no double-escaping)', () => {
    const raw = '{"summary":"Line one.\\nLine two."}'
    expect(roundtrip(raw)).toEqual({ summary: 'Line one.\nLine two.' })
  })

  it('does not touch structural whitespace between tokens (stays valid JSON)', () => {
    const raw = '{\n  "verdict": "PASS",\n  "checks": []\n}'
    expect(roundtrip(raw)).toEqual({ verdict: 'PASS', checks: [] })
  })

  it('handles escaped quotes inside a string without breaking string tracking', () => {
    const raw = '{"headline":"She said \\"go\\" and left.","body":"next\nline"}'
    expect(roundtrip(raw)).toEqual({ headline: 'She said "go" and left.', body: 'next\nline' })
  })

  it('parses a realistic multi-paragraph QC response', () => {
    const raw = '{"story_id":"s1","verdict":"FIX","checks":[{"id":"C3","result":"fail","reason":"Padding:\nfiller sentence.\n\nCut it."}],"revised_headline":"UK PM resigns","revised_summary":"Para one.\n\nPara two.","routing_note":null}'
    const out = roundtrip(raw)
    expect(out.verdict).toBe('FIX')
    expect(out.checks[0].reason).toContain('Padding')
    expect(out.revised_summary).toContain('Para two.')
  })
})
