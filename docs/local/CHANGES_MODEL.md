# My Local — "Changing Around You" as a Change product

_Design note. Reframes "Changing Around You" from a building-permit feed into an
AI-generated **Change** product. Supersedes the single `development_update` type in
spec §6 with a Change family. Full build is Phase 3; the substrate (the event /
entity / observation model, §3) is the Phase-0 spine we're already building._

---

## 1. Why (the finding that forced this)

The Marin building-permit dataset (`mkbn-caye`) is **~99% routine private
construction** — of 400 recent permits, only ~2 clear a significance bar, and one
of those is a false positive. Reroofs, MEP, solar, remodels and additions *are*
the dataset. The consequential land-use items a resident actually cares about —
subdivisions, zoning changes, use permits, environmental review, major projects —
are **planning actions** in the Planning Commission / BoS process, not building
permits. So a filter on the permit feed can't produce the product; the product has
to be built from the right sources.

## 2. The concept

Detect the **real-world change** first; show what it **means**; attach the
underlying records as evidence. The user should never see the bureaucratic event.

> Instead of: *"Design Review Application DR26-042 filed"*
> Show: **"A 48-unit housing project is proposed near downtown Novato"** — the
> application entered design review this week; it would replace a commercial
> property with 48 homes. · 0.8 mi · Proposed

Change-oriented, not news-oriented: a change **persists for months** through its
lifecycle rather than scrolling off a chronological feed.

## 3. The Change primitive

A Change is the spec's `event` (§3.6) specialized — same table, an `event_type` in
the change family, plus these fields (add to `event.attributes` / columns):

| field | notes |
|---|---|
| place | most specific place (§3.3) + distance to the reader |
| what_is_changing | the human subject ("48 homes on Grant Avenue") |
| current_state | what's there now |
| future_state | proposed / approved end state |
| stage | lifecycle (below) |
| expected_timing | "construction begins November", "vote Tuesday", "2027" |
| significance | importance 0–100 (§9) + why it matters |
| sources[] | attached records via `event_source` (§3.7): the application, agenda item, article, announcement |

Detect-then-attach = the existing origin / corroboration / update roles. One
Change, many sources.

### Lifecycle (extends `event.lifecycle_state`)
`Proposed → Under Review → Approved → Underway → Completed`
(plus `Withdrawn/Denied` as terminal). Each transition is an `event_update`
(§3.8), so the timeline and corrections log come for free. A Change stays queryable
and useful for months; it "resolves" only at Completed/Denied.

## 4. Change categories (the change_type taxonomy)

Replaces the single `development_update`. Each maps to candidate sources — **now**
= data we already touch, **new** = to add.

| category | icon | example | sources |
|---|---|---|---|
| Development & land use | 🏗 | "48 homes proposed on Grant Ave" | **new:** Planning Commission / BoS agendas & planning applications; Coastal Commission (coastal towns). *now:* BoS agenda extraction, permits (large/new only) |
| Businesses | 🍜 | "New restaurant replacing former ___" | **new:** business license filings, ABC license apps, journalism, community sources |
| Public realm | 🚲 | "Downtown Fairfax could lose 14 parking spaces" | **new:** city/county public-works & council agendas, Caltrans projects. *now:* Caltrans closures (construction) |
| Schools & community facilities | 🏫 | "School expansion approved at ___" | **new:** school district & rec/library board agendas |
| Environment & land | 🌳 | "Vegetation-management project starting near ___" | **new:** Marin Water / MMWD, parks/Open Space District, fire-district projects. *now:* CAL FIRE, FIRMS |
| Infrastructure | 🚧 | "Water main replacement on ___" (not routine maintenance) | **new:** MMWD/sanitary/PG&E capital projects, telecom permits |
| Government decisions | 🏛 | "Council approved ___ that will change ___" | *now:* BoS/Planning agenda extraction (Your Government) |

## 5. Rendering (the product)

- **Map-first.** The fundamental question is "what's changing around where I
  live?", not "what's the news?" Show changes on the Marin map (§12.2) + the list.
- **Human summaries** (LLM over structured fields, §7.5 rules): the meaning, not
  the record. Fall back to a template on validation failure.
- **Distance + stage** on every card ("0.7 mi · Under review · New this week").
- **Radius control**: 1 / 3 / 5 / 10 mi / all Marin. Region rule per D11.
- **"View all N changes on map →"**.

## 6. Reconciliation with the spec

- Supersedes §6's single `development_update` with the change-type family above
  (add rows to `local_event_type`, layer "Development"/"Community"/etc.).
- Still **Phase 3** for the full build (§15 defers development/planning). The
  Change substrate — `event` + `event_source` + `event_update` + lifecycle — is the
  Phase-0/1 spine, so nothing here is wasted; Phase 3 adds the planning/business/
  public-realm **adapters** and the change-detection + LLM "what it means" layer.
- Not a raw source feed (explicit): "Changing Around You" is an AI-generated
  product over planning records, agendas, business announcements, government
  projects, journalism and credible community sources.

## 7. Interim (Phase 1, until the Change product lands)

The current live "Changing Around You" is the routine building-permit feed. Until
the Change product exists, either:
- **(a)** rename it **"Nearby building permits"** and apply the significance
  filter (removes reroof/MEP/solar/remodel noise) — honest but sparse; or
- **(b)** leave it as-is; or
- **(c)** hide it and let "Your Government" carry planning signals for now.

Recommendation: **(a)** — stop the section from masquerading as the full Change
product while the real one is built.

## 8. Phased path

1. **Phase 0/1 (now):** event/lifecycle spine (done/underway). Interim permit
   rename+filter per §7.
2. **Phase 3 — Development & Government first:** Planning Commission + BoS agenda
   → Change detection (application → stage transitions), LLM summaries, the map +
   radius UI. This alone delivers the flagship "48 homes proposed" experience.
3. **Then broaden:** Businesses, Public realm, Schools, Environment, Infrastructure
   adapters, one category at a time, each attaching to the same Change model.
