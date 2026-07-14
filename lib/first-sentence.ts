// Extract the first sentence WITHOUT breaking on abbreviations. The old
// /^.*?[.!?](?:\s|$)/ was non-greedy, so it stopped at the first period —
// turning "Sen. Lindsey Graham died…" into "Sen." and "Dr. Lonnie Johnson…"
// into "Dr." in the rendered digest. This treats a period after a known title/
// abbreviation, a single-letter initial, or inside a dotted acronym (U.S.) as
// non-terminal, and only accepts punctuation followed by whitespace/end.

const NON_TERMINAL_ABBR = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'sen', 'rep', 'reps', 'gov', 'govs',
  'gen', 'lt', 'sgt', 'col', 'capt', 'adm', 'maj', 'cmdr', 'sir', 'jr', 'sr',
  'vs', 'etc', 'no', 'nos', 'inc', 'corp', 'co', 'ltd', 'dept', 'depts', 'univ',
  'assn', 'rev', 'hon', 'pres', 'supt', 'det', 'esq', 'ph', 'messrs', 'mt', 'ft',
  'rd', 'ave', 'blvd', 'fig', 'al', 'ed', 'eds', 'vol', 'pp', 'op', 'cf',
])

export function firstSentence(text: string): string {
  const clean = (text ?? '').trim()
  if (!clean) return clean

  const re = /[.!?]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    const idx = m.index
    const next = clean[idx + 1]
    // A real boundary is terminal punctuation followed by whitespace or end.
    if (next !== undefined && !/\s/.test(next)) continue

    if (clean[idx] === '.') {
      const prior = clean.slice(0, idx).match(/([A-Za-z][A-Za-z.'-]*)$/)?.[1] ?? ''
      const bare = prior.replace(/[.'-]/g, '').toLowerCase()
      // Title/abbreviation, single-letter initial (J.), or dotted acronym (U.S).
      if (NON_TERMINAL_ABBR.has(bare) || bare.length <= 1 || prior.includes('.')) continue
    }
    return clean.slice(0, idx + 1).trim()
  }
  return clean
}
