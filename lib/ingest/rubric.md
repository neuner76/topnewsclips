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

Self-referential statements about the story's own sourcing or corroboration level — e.g., "This account is corroborated by four independent outlets," "This story is currently single-source," "X is the sole source for this report," "(Single-source: X)" — are always a C3 fail, regardless of whether they're accurate. The confidence_label badge already conveys this in the UI; it must never be restated in the summary prose. If a revision for C5/C6 would add such a sentence, do not add it — fix attribution/labeling by other means, or leave the summary as-is if no other fix is needed.

**C4. Freshness honesty.**
If the underlying video is a retrospective, documentary, anniversary piece, or covers events older than 72 hours, the summary must say so in the first sentence (e.g., "In a retrospective on its 2016 reporting…") and the card must not appear in Need To Know or daily news sections. Retrospectives route to a clearly labeled section or are dropped.
*Real failure this catches: VICE South China Sea documentary presented alongside same-day news.*

## REVISE-LEVEL checks (fail → FIX; if unfixable → HOLD)

**C5. Attribution discipline.**
Every claim attributed to its actual source ("According to CBS News…", "The Texas Tribune interviewed…"). The summary never asserts a contested claim in TNC's own voice. Single-source stories must read as single-source.

**C6. Confidence-label consistency.**
The assigned label (Corroborated / Reported / Analysis / Single-source / Satire / Developing) must match the evidence, per TNC's tier-based policy. The numeric thresholds below are real failure conditions, not just hypotheticals — if the assigned `confidence_label` does not satisfy the rule for that label given `source_tier`/`coverage_count`, C6 **fails** with `result: "fail"` and the reason must state the correct label.
*Real failure this catches: a story assigned "Corroborated" with `coverage_count: 1` and `source_tier: 5` — 1 outlet meets neither the 5+ threshold nor the 3+-with-Tier-1-5 threshold, so the correct label is "Reported," and C6 must fail.*
- "Corroborated" requires 5+ independent outlets, OR 3+ outlets including a Tier 1-5 source.
- "Reported" is correct for any Tier 1-6 source — including with `coverage_count: 0` — because the source itself carries editorial oversight and a corrections policy. **Do not fail C6 solely because a Tier 1-6 source has `coverage_count: 0`; "Reported" is the correct label in that case, not "Single-source."**
- "Single-source" applies to Tier 7-10 sources with `coverage_count: 0`.
- "Developing" applies to Tier 7-10 sources with `coverage_count` >= 2.
- "Analysis" and "Satire" are content-type labels, always correct for their respective content types regardless of coverage_count.
`content_type`/`section` (reported / analysis / satire) and `confidence_label` are independent fields — a `content_type: reported` story can correctly carry any confidence_label (Single-source, Reported, Developing, or Corroborated) depending on `source_tier` and `coverage_count`. Do not fail C6 merely because `confidence_label` and `content_type` "don't match" — only check the label against `source_tier`/`coverage_count` per the rules above.

`coverage_count` already represents independently-corroborating outlets by construction (per `msm_outlet_coverage.covered`); do not additionally require proof that those outlets are independent of the primary source — meeting the numeric threshold (5+ outlets, or 3+ outlets with a Tier 1-5 source) is sufficient on its own to satisfy "Corroborated."

`confidence_label` is computed once for the story as a whole from `source_tier`/`coverage_count` — it is not a per-claim or per-sentence rating, and there is no mechanism to assign a different label to individual claims within the summary. For compound stories that combine a well-covered headline event with a secondary claim or angle that is less corroborated: if `coverage_count`/`source_tier` meet the threshold for the assigned label on the story as a whole, AND the secondary claim is properly attributed to its source per C5 (e.g., "according to X," "X reports"), this is NOT a C6 fail — attribution of the secondary claim is sufficient; do not downgrade or flag the overall label just because one claim within the story is less corroborated than the headline claim.

**C7. Headline ↔ summary ↔ source alignment.**
Headline claims nothing the summary doesn't support; summary claims nothing the source doesn't support. No escalation of certainty at any step (source says "claims" → headline cannot say "achieves").

**C8. Tone neutrality.**
No loaded adjectives, no outrage framing, no editorializing outside clearly marked Analysis/Satire content types. "No agenda" is testable: strip the proper nouns and the summary should not reveal a rooting interest.
