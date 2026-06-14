# Digest Pull Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Model strategy:** The relational/assembly work — role classification with `DigestContext` (Task 2), scoring calibration (Task 3), duplicate and bundled-story detection (Tasks 6/6b), state-affiliated safeguards (Task 7), region/lens integrity (Task 7b), and canonical assembly (Task 14) — involves reasoning across multiple stories and is where subtle errors propagate; use Opus (or Fable 5, Claude Code v2.1.170+) for these. The mechanical placement, copy, validation-wiring, and test-scaffolding tasks run fine on Sonnet 4.6. Switch with `/model`.

**Goal:** Improve what TopNewsClips pulls into the canonical email-first digest. The digest should feel intentionally selected, not like a complete export of everything the system found.

**Architecture:** Add per-story role classification + scoring, then a relational assembly pass (`DigestContext`) that catches cross-section defects — duplicates, bundled stories, region/lens mismatches, Blindspot diversity — before the canonical `DigestEdition` is produced and validated.

**Tech Stack:** TypeScript, Next.js, Vitest

---

## Core product principle

Every pulled item must earn scarce inbox attention.

A story should make the canonical digest only if it plays a clear role:

- lead story
- practical impact
- institutional signal
- undercovered global story
- mainstream agenda marker
- cultural texture
- reader-useful economic/health/science context

If an item is merely interesting but has no clear role, it should stay in the archive/feed pool, not the canonical digest.

## Current issue

The feed has strong structure and trust labels, but the pull logic is still too permissive. Some items are included because they are interesting and labeled, not because they deserve inbox attention.

## Architectural principle — per-story vs. relational

Some quality defects are properties of a single story (weak source, no role). Others are relational — they only exist in the context of the assembled digest: a topic duplicated across sections, a region over-represented in Blindspot, a World view lens that doesn't match its lead, a region label that disagrees with the story's actual origin. Scoring is genuinely local and stays per-story. Role classification and section placement must receive a `DigestContext` (roles, topics, and regions already filled) so relational defects are caught during assembly, not retrofitted later. Do not build classification as story-only and bolt on context in Phase 6.

## Note on examples

This is a daily product. Specific story names (the screwworm item, the Zambia item, today's Iran lead) are included only as illustrations of a pattern and will not be on the feed tomorrow. Implement the rules; never hard-code a story title as a pull/exclude target.

## Scope

### Included

- Add digest pull scoring
- Add item-role classification
- Add section-specific inclusion limits
- Add source-risk safeguards for state-affiliated/high-stakes stories
- Add placement rules for raw footage, high-strength stories, and lighter items
- Add validation for misplaced stories
- Add QA tests for canonical digest pull quality

### Not included

- Rebuilding the full story-generation pipeline
- Personalization
- Response Transparency action modules
- Major visual redesign
- Separate email and web versions
- Removing the archive/feed pool

## Success Criteria

- [ ] Every canonical digest item has an explicit role.
- [ ] Need To Know holds 2–3 items, and no lead-strength story is buried below it.
- [ ] Politics & World Affairs is capped and does not feel like a wire stack.
- [ ] State-affiliated high-stakes geopolitical claims carry caution even when corroborated.
- [ ] Raw footage does not define Science, Health & Environment unless reframed with stronger context.
- [ ] High-strength stories do not appear in Also Worth Knowing.
- [ ] Global Blindspot is capped to the strongest 3–4 items.
- [ ] No digest item bundles two unrelated stories into one entry.
- [ ] Region labels match each story's actual origin/content.
- [ ] Country-only labels fail validation when source/outlet names exist.
- [ ] Newsletter and `/feed` consume one identical canonical edition; differences are layout-only.
- [ ] Digest validation warns when an item is merely interesting but lacks a digest role.
- [ ] Score-distribution output exists so the inclusion threshold can be calibrated, not guessed.

---

## Phase 1: Add Digest Item Roles

### Task 1: Define digest item role types

**Files:**
- Create or update: `lib/digest-pull-types.ts`
- Update: `lib/digest-types.ts`

Add role enum:

```ts
export type DigestItemRole =
  | 'lead'
  | 'practical_impact'
  | 'institutional_signal'
  | 'undercovered_global'
  | 'mainstream_agenda_marker'
  | 'economic_context'
  | 'health_science_context'
  | 'cultural_texture'
  | 'developing_safety'
  | 'reader_utility'
  | 'archive_only'
```

Add to digest item type:

```ts
export interface DigestPullMetadata {
  role: DigestItemRole
  pullReason: string
  pullScore: number
  exclusionReason?: string
  riskFlags?: DigestRiskFlag[]
}

export type DigestRiskFlag =
  | 'state_affiliated_high_stakes'
  | 'raw_footage_primary'
  | 'zero_coverage'
  | 'single_source'
  | 'analysis_not_reporting'
  | 'lightweight_human_interest'
  | 'misplaced_section'
  | 'country_label_without_outlet'
  | 'region_label_mismatch'   // region value disagrees with the story's actual origin/content (higher severity than country_label_without_outlet)
  | 'bundled_multistory'      // one item's summary covers two or more unrelated events
```

**Rule:** No canonical digest item should be included without `role`, `pullReason`, and `pullScore`.

- [ ] Add role and risk types
- [ ] Add optional `pullMetadata` to digest item type
- [ ] Commit

### Task 2: Add item role classifier

**Files:**
- Create: `lib/digest-role-classifier.ts`

```ts
export function classifyDigestItemRole(
  story: Story,
  context: DigestContext   // roles, topics, and regions already filled in the digest under assembly
): DigestItemRole {
  // classify by section, topic, source strength, coverage, story type, editorial tags,
  // AND what the digest already contains (e.g. an Iran follow-up when Iran is already the lead
  // should classify toward a distinct role or archive_only)
}
```

`DigestContext` is defined in Task 14's assembly module and threaded into classification and placement. Scoring (Task 3) remains per-story.

**Suggested classification rules**

**lead** — Use for:
- major geopolitical/diplomatic development
- major mass-casualty event
- major public-health/economic/infrastructure development
- must have strong source quality or clear caution framing

**practical_impact** — Use for:
- fuel prices
- public safety
- consumer prices
- agriculture/public health
- weather/disaster logistics
- travel/infrastructure

**institutional_signal** — Use for:
- government policy shifts
- court decisions
- military posture
- public agency actions
- regulatory deadlines
- cross-border infrastructure

**undercovered_global** — Use for:
- Global Blindspot stories
- international stories receiving low U.S. outlet coverage
- must have clear international source context

**mainstream_agenda_marker** — Use for:
- Mainstream Pulse only

**economic_context** — Use for:
- used-car prices
- inflation
- interest rates
- IPO/equity/market stories
- business collapses with consumer/worker impact

**health_science_context** — Use for:
- disease, climate, agriculture, weather impacts, public health, research, environment

**cultural_texture** — Use for:
- satire
- media retrospective
- softer culture stories
- visual moments
- must be short and lower in hierarchy

**developing_safety** — Use for:
- active shootings
- severe weather
- public safety alerts
- must be sourced carefully

**reader_utility** — Use for:
- official process
- deadline
- how-to-interpret item
- one useful next step

**archive_only** — Use for:
- merely interesting items
- weakly sourced but not important
- repetitive items
- light human interest with no broader role
- raw social/source clips without sufficient context

- [ ] Implement role classifier
- [ ] Add role tests
- [ ] Commit

---

## Phase 2: Pull Scoring

### Task 3: Add digest pull score helper

**Files:**
- Create: `lib/digest-pull-score.ts`

```ts
export function calculateDigestPullScore(story: Story): {
  score: number
  role: DigestItemRole
  pullReason: string
  riskFlags: DigestRiskFlag[]
}
```

**Suggested scoring**

Start with `0`.

Add:
- major public impact: `+4`
- practical reader impact: `+3`
- strong institutional signal: `+3`
- breaking public-safety event (`developing_safety`): `+3` — must NOT be penalized for low early coverage; a mass-casualty or severe-weather safety event is most valuable when it is newest and least-covered
- source tier <= 3: `+2`
- corroborated: `+2`
- reported: `+1`
- coverageCount >= 5: `+2`
- strong undercovered global story: `+2`
- clear Global Lens comparative frame: `+1`
- useful economic/health/science context: `+2`

Subtract:
- state-affiliated high-stakes claim: `-3`
- raw footage as primary source: `-2`
- single-source: `-2`
- 0-of-15 coverage: `-2` — does not apply when role is `developing_safety` or `undercovered_global` (low coverage is expected and is the point)
- analysis not reporting: `-1`
- lightweight human-interest: `-2`
- no clear digest role: `-4`
- section mismatch: `-2`
- bundled multi-story item: `-3` (also flag `bundled_multistory`; prefer splitting over scoring)

**Inclusion threshold**

Default canonical digest threshold: `score >= 3`

Calibration required, not assumed. These weights and the threshold are starting guesses. Before relying on them, run the score-distribution dump (Task 17) against a real day. If included and excluded items both cluster at 3–5, the threshold isn't partitioning anything — adjust weights or threshold until the cut line corresponds to an editorially defensible boundary. Treat the numbers as tunable config, ideally in one constants block, not scattered literals.

**Exceptions:**
- `Global Blindspot` may include lower coverage if labeled correctly.
- `Mainstream Pulse` follows its own rules.
- `Cultural texture` can appear with lower score but must be short and capped.
- Admin/editorial override can include lower-score item only with `pullReason`.

- [ ] Implement scoring helper
- [ ] Add thresholds
- [ ] Add tests
- [ ] Commit

### Task 4: Add pull reason generation

**Files:**
- `lib/digest-pull-score.ts`
- optional: admin/debug UI

**Purpose:** Make each inclusion explainable.

**Examples:**
- `Included as lead: broadly covered developing diplomatic story with global energy implications.`
- `Included as practical impact: used-car shortage affects consumer prices.`
- `Included as institutional signal: cross-border bridge delayed at U.S. request.`
- `Included as undercovered global story: international report with low U.S. coverage.`
- `Excluded from canonical digest: interesting but no clear reader-impact role.`

- [ ] Add pull reason strings
- [ ] Expose in validation/debug output
- [ ] Commit

---

## Phase 3: Section-Specific Pull Rules

### Task 4b: Bound Need To Know (cap + buried-lead floor)

**Files:**
- digest assembly logic
- `lib/digest-section-rules.ts`

**Why:** Every other section is bounded, but Need To Know — the most important section — has no cap and no floor. The screwworm problem (a strong story demoted) is the inverse risk: a lead-strength story buried below Need To Know.

**Rule:**
- Need To Know holds 2–3 items.
- Floor (critical): if any story classifies as `lead` or scores at lead strength (e.g. `score >= 8` after calibration) but is NOT placed in Need To Know, that is a validation error, not a warning. Catch the buried lead.
- Cap: if more than 3 stories qualify, keep the strongest by score; the rest flow to their topic sections with their own roles.

- [ ] Add Need To Know cap (2–3)
- [ ] Add buried-lead floor as a critical validation error
- [ ] Add tests (a lead-strength story outside Need To Know fails)
- [ ] Commit

### Task 5: Cap Politics & World Affairs

**Files:**
- digest assembly logic
- `lib/digest-section-rules.ts`

**Rule:** Politics & World Affairs should include 4 items max in the canonical email-first digest.

Preferred roles:
1. institutional_signal
2. practical_impact
3. developing_safety
4. undercovered_global only if not already in Global Blindspot

Avoid:
- too many analysis items
- repetitive items on a topic already led in Need To Know
- 0-of-15 items unless clearly undercovered and labeled
- social commentary unless it has broader institutional relevance

**Selection priority for current pattern**

Pull, in role priority order: institutional_signal > practical_impact > developing_safety > undercovered_global (only if not already in Global Blindspot). Apply caution rules (Task 7) to any state-affiliated high-stakes item before inclusion.

Demote/exclude:
- analysis pieces without a fresh institutional/legal development
- a same-topic follow-up when the lead already covers it and the follow-up adds no distinct role (see Task 6)
- low-corroboration single-source items that aren't framed as undercovered

Examples of specific stories were removed from this task: on a daily product they describe yesterday's feed, not today's. The role-priority order and the avoid/demote patterns are the durable instruction.

- [ ] Add cap
- [ ] Add priority sort
- [ ] Add duplicate-topic suppression
- [ ] Commit

### Task 6: Add duplicate-topic suppression

**Files:**
- digest assembly logic
- `lib/digest-section-rules.ts`

**Why:** If Need To Know already has a major Iran story, lower-section Iran stories should only appear if they add distinct information.

**Rule:** If a topic appears in Need To Know, lower-section items on the same topic must provide a distinct role:
- follow-up detail
- mainstream agenda marker
- global lens contrast
- useful next step
- materially different source perspective

Otherwise demote to archive.

```ts
export function isDuplicateLowerSectionItem(story: Story, digest: DigestEdition): boolean
```

- [ ] Implement duplicate-topic detection
- [ ] Add tests with Iran lead + lower Iran strike item
- [ ] Commit

### Task 6b: Detect bundled multi-story items

**Files:**
- `lib/digest-validation.ts`
- digest assembly logic

**Why:** A single digest entry must cover a single story. On a recent feed, one Global Blindspot item bundled two unrelated reports from the same outlet (a farmers/tariff story AND an unrelated EV-adoption story) into one summary. This is the same one-item-one-story discipline applied elsewhere against escalatory bundling.

**Rule:** If an item's summary describes two or more unrelated events (distinct subjects, places, or causes joined by "Separately," "Meanwhile," "In other news," or a hard topic shift):
- flag `bundled_multistory`
- prefer splitting into separate scored items
- if not splittable from available data, keep only the stronger event and drop the remainder; never publish the bundle

```ts
export function detectBundledMultistory(story: Story): boolean
```

Detection can use the generation step (cleanest — instruct the summarizer to refuse bundling) plus a validation backstop that scans for the joining patterns above.

- [ ] Implement detection (generation-side guard + validation backstop)
- [ ] Add test: a two-topic summary is split or trimmed, never published whole
- [ ] Commit

### Task 7: Add State-Affiliated High-Stakes safeguard

**Files:**
- `lib/digest-risk.ts`
- digest assembly logic

**Rule:** If a story is:
- source type `State-Affiliated Media` / `State Media` / tier >= 8
- AND topic is high-stakes geopolitical, military, migration, war, or diplomacy

Then:
- always show caution text (the caution is about the source's incentive, not the fact's confirmation — so it applies even when the story is corroborated by independent outlets), AND
- if NOT corroborated and single-source, demote to archive rather than including with caution alone.

Clarification (resolves an ambiguity in the original): corroboration and caution are independent. A T8 high-stakes story with 5-outlet corroboration is eligible for inclusion and still carries the caution label. Corroboration earns it a place; caution stays because of who the source is. Do not let corroboration suppress the caution.

**Caution copy:**
```text
Details come from a state-affiliated outlet and should be read alongside independent confirmation.
```

**In email metadata, append:**
```text
Use with caution
```

**Do not auto-pull if:** state-affiliated AND single-source AND high-stakes AND no corroboration. (If corroborated, it may be pulled — with caution still shown.)

- [ ] Add risk detector
- [ ] Add required caution behavior (caution shown even when corroborated)
- [ ] Add tests: corroborated T8 high-stakes item is included WITH caution; uncorroborated single-source T8 high-stakes item is excluded
- [ ] Commit

### Task 7b: Region-label integrity and World view lens matching

**Files:**
- region/country assignment in the ingest or assembly path
- World view lens selection
- `lib/digest-validation.ts`

**Why:** Two distinct labeling defects, both observed on a recent lead story:

1. Wrong region label — a European monetary-policy story (ECB) was tagged "Korea." This is different from `country_label_without_outlet` (which is about preferring an outlet name over a country). Here the region value itself is wrong.
2. Mismatched World view lens — an unrelated economics story was selected as the comparative World view lens on a geopolitics lead. A World view lens must cover the same core event as the story it accompanies, not a downstream consequence or an adjacent topic.

**Rules:**
- `region_label_mismatch`: flag when a story's region value is inconsistent with its source origin/content (e.g. derive expected region from the outlet's home/known region; mismatch → flag and block from region-dependent sections until corrected).
- World view lens selection must require same-event matching. When no same-event lens exists, render no lens — never substitute a topically-adjacent different-event story.

**Validation:**
- error: a World view lens links to a story whose core event differs from the item it annotates
- error: region label inconsistent with outlet's known region

- [ ] Add region-mismatch detector
- [ ] Tighten World view lens selection to same-event
- [ ] Add tests (ECB-as-Iran-lens case fails; correct same-event lens passes)
- [ ] Commit

---

## Phase 4: Section Placement Rules

### Task 8: Enforce Science, Health & Environment placement

**Files:**
- sectioning logic
- digest validation

**Rule:** `Science, Health & Environment` should include:
- disease/public health
- agriculture impacts
- climate/weather impacts
- environment
- research/science
- technology with clear public impact

Raw footage alone should not define the section.

**Placement examples:**
- Screwworm in Texas -> Science, Health & Environment
- Midwest flooding raw footage -> Also Worth Knowing unless rewritten with stronger weather/climate context
- Autonomous drone military story -> Science/Technology only if technology angle is central; otherwise Politics/World Affairs or archive

- [ ] Update sectioning rules
- [ ] Add raw footage guard
- [ ] Move screwworm-style stories into Science, Health & Environment
- [ ] Commit

### Task 9: Enforce Business & Markets placement

**Files:**
- sectioning logic
- digest validation

**Rule:** Business & Markets should include:
- consumer prices
- markets
- corporate failures
- interest rates
- IPOs
- trade/economic policy
- employment/workforce impact

**Placement examples:**
- Used-car shortage -> Business & Markets
- ECB interest rates / energy inflation -> Business & Markets
- Barbecues Galore collapse -> Business & Markets if worker/franchisee impact is central
- SpaceX IPO -> Business & Markets if not stale/repetitive and sourced well

- [ ] Update sectioning rules
- [ ] Validate business stories are not in Also Worth Knowing if substantive
- [ ] Commit

### Task 10: Enforce Culture, Media & Society placement

**Files:**
- sectioning logic
- digest validation

**Rule:** Use `Culture, Media & Society` instead of `Sports, Entertainment, & Culture`.

Confirm first: verify whether `Sports, Entertainment, & Culture` actually exists in the current section config. On the live feed, satire currently appears in Also Worth Knowing and no dedicated culture section is present — so this may be a new section, not a rename. If no such section exists, create it; don't rename a section that isn't there.

Cross-reference (satire badges): the separate digest-polish spec requires that satire/commentary never carry a news confidence label and instead shows `Cultural lens`. When implementing `cultural_texture` placement here, do not reintroduce a confidence label on satire items — keep `Satire · T6 · Cultural lens`.

This section can include:
- satire
- media retrospectives
- documentary/true-crime media
- social/cultural analysis
- sports only when culturally significant

**Placement examples:**
- Daily Show satire -> Culture, Media & Society
- Dateline UnitedHealthcare CEO retrospective -> Culture, Media & Society
- purely sports scores/highlights -> archive unless major cultural relevance

- [ ] Rename section
- [ ] Update sectioning rules
- [ ] Keep satire items short
- [ ] Commit

### Task 11: Protect Also Worth Knowing

**Files:**
- sectioning logic
- digest validation

**Rule:** Also Worth Knowing is for:
- lower-stakes stories
- visual moments
- interesting side notes
- softer human-interest
- lighter texture

Do not place high-strength/high-impact stories here.

**Validation warning:** Warn if item in Also Worth Knowing has:
- sourceTier <= 3
- confidence `Corroborated`
- coverageCount >= 5
- AND role is not `cultural_texture`

Example: Screwworm should not be Also Worth Knowing.

- [ ] Add validation
- [ ] Add tests
- [ ] Commit

---

## Phase 5: Global Sections

### Task 12: Cap and rank Global Blindspot

**Files:**
- Global Blindspot assembly

**Rule:** Global Blindspot should include 3 items, 4 max.

**Selection priority:**
1. high public impact
2. clear undercovered status
3. strong source quality
4. regional diversity (a set-level property — enforce during assembly using `DigestContext`, not per-story)
5. not state-affiliated single-source unless clearly caveated

Apply Task 6b: no Blindspot item may bundle two unrelated stories (this defect has appeared specifically in this section).

Specific story picks were removed — they describe a particular day's feed and rot immediately. Implement the priority order and caps; let them select the day's items.

State-affiliated single-source high-stakes items in this section follow Task 7 (caution shown, or excluded if uncorroborated).

- [ ] Add cap (3, max 4)
- [ ] Add ranking by the priority order, with regional diversity enforced set-level
- [ ] Add state-affiliated caution (per Task 7)
- [ ] Apply bundled-multistory guard (per Task 6b)
- [ ] Commit

### Task 13: Keep Global Lens concise and source-consistent

**Files:**
- Global Lens assembly/validation

**Rule:** Keep 2–3 items. Each should answer: What does this outlet center that U.S. coverage may not?

**Validation:**
- outlet name must match summary text
- max 45 words
- no duplicate base-story summary

- [ ] Enforce cap
- [ ] Enforce word limit
- [ ] Validate source consistency
- [ ] Commit

---

## Phase 6: Canonical Digest Pull Assembly

### Task 14: Build canonical digest pull function

**Files:**
- `lib/digest-assembly.ts`
- `lib/digest.ts`

```ts
export function buildCanonicalDigestFromStoryPool(stories: Story[]): DigestEdition

// Threaded through classification and placement so relational defects are caught at assembly:
export interface DigestContext {
  rolesFilled: DigestItemRole[]
  topicsPresent: string[]        // for duplicate-topic suppression (Task 6)
  regionsPresent: string[]       // for Blindspot regional diversity (Task 12)
  leadTopic?: string
}
```

**Pipeline:**
1. Classify each story role (with `DigestContext`).
2. Score each story (per-story).
3. Apply risk flags (including `region_label_mismatch`, `bundled_multistory`).
4. Apply section placement rules (with `DigestContext`).
5. Apply duplicate-topic suppression.
6. Cap sections (including Need To Know bounds, Task 4b).
7. Validate digest.
8. Return canonical digest.

**Important — single canonical edition**

The function produces ONE `DigestEdition` consumed by both the newsletter and `/feed`. This is an invariant, not a goal: both surfaces render the same selected items in the same order. Differences between email and web are presentation/layout only (column widths, image handling) — never selection, ordering, or labeling. The validation step (Task 16) treats any selection divergence between the two as a critical error.

- [ ] Implement assembly pipeline
- [ ] Define and thread `DigestContext`
- [ ] Enforce single-edition invariant (email and web select identically)
- [ ] Add debug output for excluded items
- [ ] Commit

### Task 15: Add editorial override support

**Files:**
- digest assembly config
- admin/debug config

**Why:** The system should be strict by default, but editors/admin should be able to include something with a reason.

**Suggested override:**

```ts
editorialPullOverride?: {
  include?: boolean
  section?: string
  role?: DigestItemRole
  reason: string
  caution?: string
}
```

**Rules:**
- Override requires a reason.
- Override should still display relevant caution labels.
- Override cannot suppress state-affiliated high-stakes caution.
- Override should appear in validation/debug output.

- [ ] Add override type
- [ ] Respect override in assembly
- [ ] Add tests
- [ ] Commit

---

## Phase 7: Validation and QA

### Task 16: Add pull quality validation

**Files:**
- `lib/digest-validation.ts`

**Validation warnings:**
- item has no role
- item score below threshold without override
- politics section exceeds 4 items
- state-affiliated high-stakes item lacks caution (even if corroborated)
- raw footage defines Science/Health section
- high-strength story appears in Also Worth Knowing
- country-only label used when outlet exists
- region label inconsistent with the story's known origin (`region_label_mismatch`)
- lower-section item duplicates Need To Know topic without distinct role
- Global Blindspot exceeds 4 items
- Global Lens exceeds 3 items
- Need To Know has fewer than 2 or more than 3 items

**Critical errors:**
- no Need To Know
- a lead-strength story is placed outside Need To Know (buried lead)
- a World view lens annotates an item whose core event differs (mismatched lens)
- an item bundles two unrelated stories (`bundled_multistory`)
- missing source/confidence metadata
- missing URLs
- unsafe state-affiliated high-stakes single-source item included without override/caution
- email/web canonical selection mismatch (any difference beyond layout)

- [ ] Add validation rules
- [ ] Add tests
- [ ] Commit

### Task 17: Add digest pull QA command

**Files:**
- `scripts/validate-digest.ts`
- `package.json`

**Command:**
```bash
npm run validate:digest
```

**Output should include:**
- included stories by section
- role
- score
- risk flags
- pull reason
- excluded high-interest stories and why
- validation warnings/errors
- score distribution — a histogram or sorted list of all candidate scores with the include/exclude cut line marked, so the threshold can be calibrated against a real day rather than assumed. If included and excluded items both pile up around the threshold, the cut isn't discriminating and weights need tuning.

- [ ] Add/update command
- [ ] Confirm useful console output
- [ ] Include score-distribution view for threshold calibration
- [ ] Commit

---

## Phase 8: Tests

### Task 18: Add test suite

**Files:**
- `lib/digest-pull-score.test.ts`
- `lib/digest-role-classifier.test.ts`
- `lib/digest-section-rules.test.ts`
- `lib/digest-validation.test.ts`

**Test cases** — phrase tests around the pattern, using fixtures, not whatever is on today's live feed:

- A T1/Corroborated agriculture/health story is routed to Science, Health & Environment, not Also Worth Knowing.
- A cross-border infrastructure story gets `institutional_signal`.
- A used-car/inflation story gets `economic_context` and lands in Business & Markets.
- A state-affiliated high-stakes story with NO corroboration is excluded; the same story WITH 5-outlet corroboration is included and still shows caution.
- Weather raw footage does not define Science/Health alone.
- Politics & World Affairs caps at 4; Need To Know holds 2–3.
- A lead-strength story placed outside Need To Know raises a critical error (buried lead).
- A duplicate lower-section item on the lead's topic is suppressed unless it adds a distinct role.
- A satire item gets `cultural_texture`, a one-sentence limit, and `Cultural lens` (never a confidence label).
- A blindspot item whose summary covers two unrelated events is split or trimmed (`bundled_multistory`), never published whole.
- A story whose region label disagrees with its outlet's origin raises `region_label_mismatch`.
- A World view lens pointing to a different-event story fails validation.
- A high-strength story in Also Worth Knowing triggers a warning.
- An archive-only story does not enter the canonical digest.
- The same `DigestEdition` drives email and web; an injected selection difference raises the canonical-mismatch error.

- [ ] Add tests
- [ ] Run tests
- [ ] Commit

---

## Phase 9: Visual/Content QA

### Task 19: QA current digest pull

**Run:**
```bash
npm run validate:digest
npm run dev
npx tsc --noEmit
npm run build
```

**Check:**
- `/feed`
- newsletter preview
- email HTML
- mobile email width
- mobile feed

**Verify:**
- [ ] Need To Know has 2–3 strong items.
- [ ] Politics & World Affairs has 4 max.
- [ ] Science, Health & Environment contains screwworm/public-health/weather-context items, not raw footage alone.
- [ ] Business & Markets contains used-car, ECB, corporate/economy items.
- [ ] Culture, Media & Society contains Daily Show/Dateline-style items and stays short.
- [ ] Also Worth Knowing contains lower-stakes items only.
- [ ] Global Blindspot has 3–4 items max.
- [ ] Global Lens has 2–3 concise items.
- [ ] Metadata is complete and consistent.
- [ ] State-affiliated high-stakes stories carry caution or are omitted.
- [ ] Excluded items are explainable in debug output.

---

## Recommended Commit Order

1. `feat: add digest item roles and risk flags (incl. region_label_mismatch, bundled_multistory)`
2. `feat: add digest pull scoring with developing_safety weight and calibratable threshold`
3. `feat: add Need To Know bounds and buried-lead floor`
4. `feat: add section-specific pull rules`
5. `feat: add duplicate-topic and bundled-multistory suppression`
6. `feat: add state-affiliated high-stakes safeguards (caution even when corroborated)`
7. `feat: add region-label integrity and same-event World view lens matching`
8. `feat: refine science business and culture placement`
9. `feat: cap global blindspot and global lens pulls`
10. `feat: build canonical digest assembly with DigestContext and single-edition invariant`
11. `feat: add editorial pull overrides`
12. `test: add digest pull quality guardrail tests`
13. `chore: expand validate digest QA command with score distribution`

---

## Product Copy

**Caution for state-affiliated high-stakes stories:**
```
Use with caution
```
or:
```
Details come from a state-affiliated outlet and should be read alongside independent confirmation.
```

**Archive/demoted debug reason:**
```
Excluded from canonical digest: interesting but no clear reader-impact role.
```

**More link when section capped:**
```
More in the full archive →
```

**Digest role language for admin/debug:**
- Lead
- Practical impact
- Institutional signal
- Undercovered global
- Economic context
- Health/science context
- Cultural texture
- Mainstream agenda marker

---

## Guardrails

- Do not include a story just because it is interesting.
- Do not overfill Politics & World Affairs.
- Do not auto-pull high-stakes state-affiliated claims without caution — and keep the caution even when the claim is corroborated.
- Do not place serious public-health/agriculture/economy stories in Also Worth Knowing.
- Do not let raw footage define a serious section.
- Do not bundle two unrelated stories into one digest item.
- Do not annotate a story with a World view lens about a different event.
- Do not ship a wrong region label; the region must match the story's origin.
- Do not duplicate a Need To Know topic in lower sections unless the lower item adds a distinct role.
- Do not bury a lead-strength story below Need To Know.
- Do not bury undercovered stories automatically; label and position them correctly.
- Do not create separate email and web editorial versions.
- Do not hard-code specific story titles as pull/exclude targets; implement patterns.

---

## Final Recommendation

Build this as a digest pull quality layer.

The goal is not fewer stories for its own sake. The goal is better editorial intent.

Every story in the canonical digest should answer: **Why does this deserve the reader's inbox attention today?**

If the system cannot answer that, the story belongs in the archive, not the digest.
