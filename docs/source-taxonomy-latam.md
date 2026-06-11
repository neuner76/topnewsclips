# Latin America Source Taxonomy — Backlog

Drafted additions to the source taxonomy, blocked on web/RSS ingestion (see "Pipeline
note" below). Tier numbers follow the live taxonomy in
[`lib/ingest/source-tier.ts`](../lib/ingest/source-tier.ts) and
[`/taxonomy`](../app/taxonomy/page.tsx) (T1 Nonprofit Investigative · T2 OSINT ·
T3 Public Broadcaster · T4 Independent News · T5 Wire Service · T6 Newsroom ·
T7 Independent Commentary).

## El Faro English — Tier 1 (Nonprofit Investigative)

- **URL:** elfaro.net/en · **Handle:** @elfaroenglish
- **Region/beat:** Central America (El Salvador, Guatemala, Honduras, Nicaragua) — organized crime, corruption, migration, human rights, politics
- **Profile:** English edition of El Faro, Latin America's first digital-native newspaper (founded 1998, San Salvador). Multi-award-winning investigative outlet; newsroom now operating in exile (Guatemala / Washington, D.C.) following surveillance and legal harassment by the Bukele government. Active collaborations with PBS FRONTLINE (2026 CECOT documentary).
- **Editorial standards:** Investigative methodology, published corrections contact, transparent masthead and ownership history.
- **Disclosure notes:** Exile status is itself context — Salvadoran government actively hostile to the outlet; expect official denials of its reporting.
- **Confidence-label guidance:** Own investigations → Single-source until corroborated, weight as T1. Regional briefings citing other outlets → attribute through to the underlying source.
- **Ingest notes:** Text-first. YouTube presence (@ElFaroNet) is mostly Spanish-language and not a clean match for the clips pipeline. **Requires web/RSS ingestion.**

## InSight Crime — Tier 1 (Nonprofit Investigative)

- **URL:** insightcrime.org
- **Region/beat:** Latin America + Caribbean — organized crime, trafficking, security policy, criminal governance
- **Profile:** 501(c)(3) nonprofit think tank and investigative media organization (founded 2010), offices in Washington, D.C. and Medellín. Widely cited by major international outlets; the standard English-language reference on LatAm organized crime.
- **Editorial standards:** Named investigators, methodology pages, sustained beat expertise.
- **Disclosure notes (publish this):** Funding mix includes government grants — including US State Department (Bureau of Western Hemisphere Affairs) funding in recent years — alongside foundation and corporate philanthropy. Not disqualifying; consistent with nonprofit-media norms, but TNC's transparency standard means the source page should say so plainly.
- **Confidence-label guidance:** Investigations → T1 weight. Analysis/GameChangers pieces → label Analysis.
- **Ingest notes:** Text-first; limited YouTube. **Requires web/RSS ingestion.**

## The Brazilian Report — Tier 4 (Independent News)

- **URL:** brazilian.report
- **Region/beat:** Brazil — politics, economy, business, society
- **Profile:** Independent, subscription-funded English-language outlet covering Brazil for an international audience. No legacy-media or state ownership; reader-revenue model.
- **Confidence-label guidance:** Reported pieces → Reported. Daily briefings → attribute through to underlying sources where cited.
- **Ingest notes:** Text/newsletter/podcast-first. **Requires web/RSS ingestion.**

## Mexico News Daily — Tier 6 (Newsroom)

- **URL:** mexiconewsdaily.com
- **Region/beat:** Mexico — general news, politics, economy, expat/practical coverage
- **Profile:** English-language daily covering Mexico; useful breadth on a country US outlets cover almost exclusively through the border/security lens.
- **Disclosure notes:** Mixed original reporting and aggregation of Mexican-language press — label aggregated items by their underlying source.
- **Ingest notes:** Text-first. **Requires web/RSS ingestion.**

## Americas Quarterly — Tier 7 (Commentary / Analysis)

- **URL:** americasquarterly.org
- **Region/beat:** Hemisphere-wide policy analysis — politics, economics, US–LatAm relations
- **Profile:** Published by Americas Society/Council of the Americas (AS/COA). High-quality expert analysis; institutional perspective leans pro-trade/engagement.
- **Disclosure notes:** Publisher is a business-and-policy membership organization — note the institutional vantage point on the source page.
- **Confidence-label guidance:** Always Analysis, never Reported.
- **Ingest notes:** Text-first. **Requires web/RSS ingestion.**

## Latin America Daily Briefing — Internal radar (do not cite)

- **URL:** latinamericadailybriefing.substack.com (Jordana Timerman)
- **Role:** Discovery feed for the editorial/ingest pipeline, not a citable source. Sharp daily roundup of regional coverage with links to primary outlets.
- **Rule:** Stories surfaced here are traced to and cited from the primary outlet, which carries its own tier label.

## Pipeline note (the real blocker)

Five of six entries above are **text-first sources with no usable YouTube channel.** The
current ingest pipeline is YouTube-only, so the LatAm blindspot cannot actually be closed
by taxonomy entries alone — it needs a web/RSS ingest path. This is the same architectural
gap as multi-source clustering, and arguably the strongest single argument for building it:
the best Latin America journalism in English does not live on YouTube.

**Interim option (implemented 2026-06-11):** France 24 English, DW News, and Al Jazeera
English (already in the mix, all on YouTube) carry meaningful LatAm coverage. Expanded
`REGION_KEYWORDS['latin-america']` in
[`lib/story-taxonomy.ts`](../lib/story-taxonomy.ts) with Central American, Caribbean, and
South American country names (El Salvador, Guatemala, Honduras, Nicaragua, Costa Rica,
Panama, Peru, Ecuador, Bolivia, Paraguay, Uruguay, Cuba, Haiti, Dominican Republic,
"Bukele") so their LatAm segments get tagged `latin-america` (and `global-blindspot` when
`msm_gap` is set) until web ingestion ships.
