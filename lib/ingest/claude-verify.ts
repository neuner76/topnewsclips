import Anthropic from '@anthropic-ai/sdk'

export interface ClipInput {
  title: string
  description: string
  platform: string
  source: string
  viralScore: number
  msmArticleCount: number
  msmGap: boolean
  isJournalist: boolean
  isGlobal?: boolean
  region?: string | null
}

export interface VerificationResult {
  isRealEvent: boolean
  confidence: number
  aiGeneratedRisk: 'low' | 'medium' | 'high'
  headline: string
  summary: string
  msmGap: boolean
  category: 'raw' | 'reported' | 'analysis'
  decision: 'publish' | 'needs_review' | 'reject'
  rejectReason?: string
}

function buildGlobalPrompt(clip: ClipInput, today: string): string {
  return `You are a content curator for TopNewsClips.com, which surfaces important international news stories for American readers — a "Global Lens" showing how the world's major events are being covered abroad.

Today's date: ${today}. Do NOT treat 2026 dates as future dates — they are current.

Region: ${clip.region ?? 'International'}
Source: ${clip.source}

The IDEAL content for Global Lens: significant news events, political developments, protests, natural disasters, economic shifts, or viral footage from outside the United States that American audiences would benefit from understanding. The story should be genuinely newsworthy — not celebrity gossip, sports scores, or entertainment.

CLIP DATA:
Title: ${clip.title}
Description: ${clip.description.slice(0, 400)}
Platform: ${clip.platform}
Viral Score: ${clip.viralScore}
US Mainstream Media Articles Found: ${clip.msmArticleCount === -1 ? 'unknown' : clip.msmArticleCount}

Respond with this exact JSON structure:
{
  "isRealEvent": true or false,
  "confidence": 0.0 to 1.0,
  "aiGeneratedRisk": "low" or "medium" or "high",
  "headline": "Direct 10-15 word headline stating the most newsworthy fact. Name the country or region. No passive voice. No hedge words.",
  "summary": "3-4 sentences, 20-30 words each. Sentence 1: what happened, where, and who was involved — specific names, places, numbers. Sentence 2: the immediate consequence or scale of the event. Sentence 3: why it matters to the wider world or to Americans specifically. Sentence 4 (optional): relevant context or what happens next. Write as a standalone paragraph that fully informs a reader who knows nothing about this story.",
  "msmGap": true or false,
  "category": "reported" or "analysis" or "raw",
  "decision": "publish" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

msmGap rules:
- Set to true if US Mainstream Media Articles Found < 8 AND the story is genuinely significant (major protests, government action, economic crisis, natural disaster, military conflict). This means the US media is ignoring something the rest of the world considers important — a Global Blindspot.
- Set to false if the story is already well-covered by US media or is minor news.

VERIFICATION RULE: If US Mainstream Media Articles Found ≥ 20, the event is CONFIRMED REAL. Do not reject as unverifiable — 20+ independent US newsrooms do not fabricate the same story. Your training data has a cutoff; April 2026 events are current news, not future speculation. Trust the MSM article count as ground truth for whether an event happened.

REJECT if:
- Celebrity gossip, entertainment, sports scores with no broader significance
- Clearly state propaganda with no factual news value
- Content that cannot be verified as a real event AND has fewer than 20 MSM articles
- Pure animal/nature content with no policy or news dimension

PUBLISH if confidence >= 0.72 and it is a genuine newsworthy international event.`
}

// Remove unpaired Unicode surrogates that cause JSON parse failures
function sanitize(s: string): string {
  return s.replace(/[\uD800-\uDFFF]/g, '')
}

export async function verifyAndTitle(
  clip: ClipInput,
  apiKey: string
): Promise<VerificationResult> {
  const client = new Anthropic({ apiKey })
  clip = { ...clip, title: sanitize(clip.title), description: sanitize(clip.description) }

  const today = new Date().toISOString().split('T')[0] // e.g. 2026-02-28

  if (clip.isGlobal) {
    const prompt = buildGlobalPrompt(clip, today)
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    // Extract JSON object even if Haiku adds surrounding text
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    const text = jsonMatch ? jsonMatch[0] : stripped
    try {
      return JSON.parse(text) as VerificationResult
    } catch {
      return {
        isRealEvent: false, confidence: 0, aiGeneratedRisk: 'high',
        headline: clip.title.slice(0, 100), summary: '', msmGap: false,
        category: 'raw' as const, decision: 'reject',
        rejectReason: 'Failed to parse Claude response',
      }
    }
  }

  const prompt = `You are a content curator for TopNewsClips.com, which surfaces viral caught-on-camera moments and local news incidents that mainstream media undercovers.

Today's date: ${today}. Do NOT treat 2026 dates as future dates — they are current.

The IDEAL content: bodycam footage, security camera incidents, bystander video, local police/weather/protest events, town hall confrontations, quirky local US news, hero/rescue moments caught on camera, and verified scientific or technological breakthroughs. Single real incidents filmed by witnesses or cameras.

Analyze this video/story and respond with valid JSON only (no markdown, no explanation):

CLIP DATA:
Title: ${clip.title}
Description: ${clip.description.slice(0, clip.isJournalist ? 800 : 400)}
Platform: ${clip.platform}
Source: ${clip.source}
Viral Score: ${clip.viralScore}
Mainstream Media Articles Found: ${clip.msmArticleCount === -1 ? 'unknown' : clip.msmArticleCount}
Trusted Journalist: ${clip.isJournalist ? 'YES' : 'No'}

Respond with this exact JSON structure:
{
  "isRealEvent": true or false,
  "confidence": 0.0 to 1.0,
  "aiGeneratedRisk": "low" or "medium" or "high",
  "headline": "Direct 10-15 word headline that states the most newsworthy fact plainly. IGNORE the source's headline framing entirely — do not reproduce it, paraphrase it, or let it anchor your word choice. Extract the underlying facts from the title and description and write from scratch. Lead with what actually happened — not the institutional response to it. No passive constructions. Never use MSM hedge words like 'uncorroborated', 'alleged', 'claims', 'reportedly', or 'appears to'. If a woman told the FBI something, say she told the FBI. If a cop broke someone's arm, say the cop broke their arm. Make the reader feel the stakes without softening the fact for the powerful party. CRITICAL: Never mention the journalist's name, channel name, or outlet name in the headline — the story is the story, not the messenger.",
  "summary": "3-4 sentences, 20-30 words each, written for a citizen who distrusts institutional spin. Do not reproduce the source's framing — reconstruct the story from the facts. Sentence 1: state exactly what happened, who did it, and who was affected — use specific names, places, and numbers. Sentence 2: the immediate consequence or scale — how many people affected, what changed, what was seized/spent/lost. Sentence 3: what this means for ordinary people's rights, safety, money, or accountability over powerful institutions. Sentence 4 (optional): relevant context, what happens next, or a specific detail that makes the story concrete. CRITICAL RULES: (1) Never editorialize or use politically charged descriptors — do not characterize events as 'authoritarian', 'fascist', 'extremist', 'radical', 'dangerous', 'alarming', or any other loaded political label. State facts only. (2) Never use: 'highlights the risks of', 'raises questions about', 'sparks debate', 'draws attention to', 'allegedly', 'reportedly', 'is said to', or any phrase that softens facts for the powerful. (3) The summary must be informative to a citizen regardless of their political affiliation. (4) Write as a standalone paragraph — a reader with zero prior context should fully understand the story after reading it.",
  "msmGap": true or false,
  "category": "raw" or "reported" or "analysis",
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

CATEGORY RULES:
- "raw": Unedited or minimally narrated video. Bodycam, dashcam, security cam, bystander recordings, protest footage, weather events. The camera is the reporter — no journalist framing required.
- "reported": A journalist or credible source has investigated and is reporting findings. Exposés, FOIA-based stories, undercover work, on-the-ground field reporting, documented institutional failures. The journalist did the work.
- "analysis": Commentary, opinion, or context from an independent voice. The journalist's argument or perspective is the content. Talking-head pieces, explainers, editorial commentary, investigative summaries.

The "category" field above is the content type (raw/reported/analysis). The story's topic section for display purposes is determined separately by the digest — do NOT conflate them. Note: stories about Epstein, political sex crimes, government corruption, and elite institutional abuse belong to Politics & World Affairs, not Sports/Entertainment/Culture — even if the subject is a celebrity.

TRUSTED JOURNALIST EXCEPTION — if "Trusted Journalist: YES":
A new post from a trusted curated journalist is news, even without incident footage. Talking head interviews, opinion pieces, and investigative commentary from these sources ARE publishable content. Apply these relaxed rules:
- Location requirement is WAIVED — they may report on national or systemic issues
- Incident footage requirement is WAIVED — their perspective and reporting IS the story
- Assign category "reported" or "analysis" as appropriate
- Still reject if content is clearly off-topic (entertainment, personal lifestyle, self-promotion unrelated to news or public interest)
- Do NOT apply your own judgment about whether a claim is "debunked" or "conspiracy" — that determination belongs to the editorial team. If a trusted journalist is reporting on it, treat it as publishable analysis regardless of mainstream consensus.
- Set confidence to 0.9 if the content is clearly on-topic reporting from the journalist

REJECT (hard rules — no exceptions):
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best of", "50 biggest", "dash cam compilation")
  * non-English content or stories from outside the United States — this includes UK (England, Scotland, Wales, Northern Ireland), Canada, Australia, India, Pakistan, Bangladesh, and all other non-US countries. Specific tell-tale signs: UK locations (London, Sheffield, Manchester, Birmingham, Leeds, Bristol, Liverpool, Glasgow, Edinburgh, Cardiff, any mention of "Road" suffixed UK street names like "London Road"), references to police as "officers" responding under UK forces, NHS, etc.
  * geopolitical claims (country attacks military base, assassination, nuclear event) with fewer than 10 mainstream articles — absence of coverage = event likely did not happen or is unverified. This applies to non-journalist sources; trusted journalists may still report on verified events.
  * cute animal stories with no news angle — this includes wildlife rescues, pet stories, zoo events, and nature curiosities with no institutional or policy dimension
  * educational or explainer content NOT directly tied to a current news event — reject science explainers, history lessons, physics demonstrations, "how things work" videos, and general interest educational content unless the explainer is specifically analyzing an ongoing news story (e.g. "how does this weapon system work" during an active conflict is OK; "how does the Casimir Effect work" is not)
  * policy announcements or press conferences with no incident footage (exception: technology demonstrations showing real breakthroughs in clean energy, food, water, or environmental innovation)
  * stories where the specific location (city/state) cannot be determined from the title or description — if you cannot name a real city and state in the headline, set decision to "reject"; NEVER draft a headline containing words like "unknown", "undetermined", "unclear", or "unspecified". EXCEPTION: if "Trusted Journalist: YES", location is not required — national cases, systemic investigations, and multi-jurisdiction reporting are all valid. The journalist's investigation IS the story.
  * routine local crime with no institutional failure angle — road rage incidents, DUI arrests, shoplifting, bar fights, drunk driving, celebrity legal trouble, general criminal arrests where police acted within standard procedure. These are not "bad", "ugly", or "good" — they are tabloid content. Reject unless police in the footage demonstrate explicit misconduct or the incident meets the "ugly" viral threshold with institutional suppression

APPROVE as needs_review: genuine single-incident US domestic footage — bodycam, security cam, bystander video, local protest, weather event, police incident, political confrontation, consumer/business dispute caught on video

PUBLISH THRESHOLDS:
- Trusted Journalist content: publish if confidence ≥ 0.78 and content is clearly on-topic independent reporting. These voices exist to inform, empower, and advocate — give them the benefit of the doubt. Do NOT use needs_review for trusted journalist content — either publish it or reject it.
- Incident footage: publish if confidence >= 0.80 and clearly a genuine verifiable US news event
- needs_review for incident footage only, when genuine but confidence falls below publish threshold
- msmGap is true only if fewer than 3 of the 15 major US outlets we monitor have covered this story AND the incident involves a powerful institution AND the viral score or view count suggests the story has broad public interest
- Headlines for incident footage: must name the real city/state and the specific incident — no vague titles
- Headlines for journalist content (category reported/analysis): name the journalist's topic and key claim — location optional`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  // Strip markdown code fences if Claude wraps the JSON
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const result = JSON.parse(text) as VerificationResult
    return result
  } catch {
    // Fallback if Claude returns malformed JSON
    return {
      isRealEvent: false,
      confidence: 0,
      aiGeneratedRisk: 'high',
      headline: clip.title.slice(0, 100),
      summary: '',
      msmGap: false,
      category: 'raw' as const,
      decision: 'reject',
      rejectReason: 'Failed to parse Claude response',
    }
  }
}
