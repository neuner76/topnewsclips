# TNC Pre-Publish QC Rubric (v1)

Each check returns `pass` / `fail` with a one-line reason. Severity determines the verdict.

## BLOCKING checks (any fail → FIX or HOLD)

**C1. Promo/junk leak.**
Summary must contain zero: tour links, merch links, social handles, "subscribe," "check out," channel self-promotion, hashtags, emoji spam, or raw YouTube description text. Satire and comedy entries are the highest-risk category — the summary must describe the comedic content, never repeat the creator's promo copy.
*Real failure this catches: Josh Johnson card ran "Check out joshjohnsoncomedy.com/tour... Hit me on them internets" verbatim.*

**C2. Named principals.**
Every person who is the subject of the story must be named if the source names them. "A former U.S. president" when the source identifies him by name is a fail. Exception: source genuinely withholds the name (then the summary must say "unnamed in source reporting").
*Real failure this catches: "Former president booed at NBA Finals" — never named.*

**C3. Precision of claims.**
No mush. Flags: "under these circumstances," "in this way," "notably," "reportedly significant," any sentence whose meaning survives deletion. Every sentence must carry a concrete fact: who, what, number, date, or place.

**C4. Freshness honesty.**
If the underlying video is a retrospective, documentary, anniversary piece, or covers events older than 72 hours, the summary must say so in the first sentence (e.g., "In a retrospective on its 2016 reporting…") and the card must not appear in Need To Know or daily news sections. Retrospectives route to a clearly labeled section or are dropped.
*Real failure this catches: VICE South China Sea documentary presented alongside same-day news.*

## REVISE-LEVEL checks (fail → FIX; if unfixable → HOLD)

**C5. Attribution discipline.**
Every claim attributed to its actual source ("According to CBS News…", "The Texas Tribune interviewed…"). The summary never asserts a contested claim in TNC's own voice. Single-source stories must read as single-source.

**C6. Confidence-label consistency.**
The assigned label (Corroborated / Reported / Analysis / Single-source / Satire / Developing) must match the evidence, per TNC's tier-based policy:
- "Corroborated" requires 5+ independent outlets, OR 3+ outlets including a Tier 1-5 source.
- "Reported" is correct for any Tier 1-6 source — including with `coverage_count: 0` — because the source itself carries editorial oversight and a corrections policy. **Do not fail C6 solely because a Tier 1-6 source has `coverage_count: 0`; "Reported" is the correct label in that case, not "Single-source."**
- "Single-source" applies to Tier 7-10 sources with `coverage_count: 0`.
- "Developing" applies to Tier 7-10 sources with `coverage_count` >= 2.
- "Analysis" and "Satire" are content-type labels, always correct for their respective content types regardless of coverage_count.
`content_type`/`section` (reported / analysis / satire) and `confidence_label` are independent fields — a `content_type: reported` story can correctly carry any confidence_label (Single-source, Reported, Developing, or Corroborated) depending on `source_tier` and `coverage_count`. Do not fail C6 merely because `confidence_label` and `content_type` "don't match" — only check the label against `source_tier`/`coverage_count` per the rules above.

**C7. Headline ↔ summary ↔ source alignment.**
Headline claims nothing the summary doesn't support; summary claims nothing the source doesn't support. No escalation of certainty at any step (source says "claims" → headline cannot say "achieves").

**C8. Tone neutrality.**
No loaded adjectives, no outrage framing, no editorializing outside clearly marked Analysis/Satire content types. "No agenda" is testable: strip the proper nouns and the summary should not reveal a rooting interest.
