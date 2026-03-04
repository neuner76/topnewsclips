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

export async function verifyAndTitle(
  clip: ClipInput,
  apiKey: string
): Promise<VerificationResult> {
  const client = new Anthropic({ apiKey })

  const today = new Date().toISOString().split('T')[0] // e.g. 2026-02-28

  const prompt = `You are a content curator for TopNewsClips.com, which surfaces viral caught-on-camera moments and local news incidents that mainstream media undercovers.

Today's date: ${today}. Do NOT treat 2026 dates as future dates — they are current.

The IDEAL content: bodycam footage, security camera incidents, bystander video, local police/weather/protest events, town hall confrontations, quirky local US news, hero/rescue moments caught on camera, and verified scientific or technological breakthroughs. Single real incidents filmed by witnesses or cameras.

Analyze this video/story and respond with valid JSON only (no markdown, no explanation):

CLIP DATA:
Title: ${clip.title}
Description: ${clip.description.slice(0, 400)}
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
  "headline": "Compelling 10-15 word headline. Never start with the journalist's name or 'Trusted Journalist'. Lead with the story.",
  "summary": "2 sentences. Sentence 1: what specifically happened and the specific outcome. Sentence 2: what makes it notable or visually compelling. Never use vague phrases like 'highlights the risks of' or 'raises questions about' — be specific and concrete.",
  "msmGap": true or false,
  "category": "raw" or "reported" or "analysis",
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

CATEGORY RULES:
- "raw": Unedited or minimally narrated video. Bodycam, dashcam, security cam, bystander recordings, protest footage, weather events. The camera is the reporter — no journalist framing required.
- "reported": A journalist or credible source has investigated and is reporting findings. Exposés, FOIA-based stories, undercover work, on-the-ground field reporting, documented institutional failures. The journalist did the work.
- "analysis": Commentary, opinion, or context from an independent voice. The journalist's argument or perspective is the content. Talking-head pieces, explainers, editorial commentary, investigative summaries.

TRUSTED JOURNALIST EXCEPTION — if "Trusted Journalist: YES":
A new post from a trusted curated journalist is news, even without incident footage. Talking head interviews, opinion pieces, and investigative commentary from these sources ARE publishable content. Apply these relaxed rules:
- Location requirement is WAIVED — they may report on national or systemic issues
- Incident footage requirement is WAIVED — their perspective and reporting IS the story
- Assign category "reported" or "analysis" as appropriate
- Still reject if content is clearly off-topic (entertainment, personal lifestyle, self-promotion unrelated to news or public interest)
- Set confidence to 0.9 if the content is clearly on-topic reporting from the journalist

REJECT (hard rules — no exceptions):
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best of", "50 biggest", "dash cam compilation")
  * non-English content or stories from outside the United States — this includes UK (England, Scotland, Wales, Northern Ireland), Canada, Australia, India, Pakistan, Bangladesh, and all other non-US countries. Specific tell-tale signs: UK locations (London, Sheffield, Manchester, Birmingham, Leeds, Bristol, Liverpool, Glasgow, Edinburgh, Cardiff, any mention of "Road" suffixed UK street names like "London Road"), references to police as "officers" responding under UK forces, NHS, etc.
  * any international military conflict, missile strike, drone attack, or war footage — EXCEPTION: if "Trusted Journalist: YES" AND Mainstream Media Articles Found ≥ 20, the journalist's analysis or reporting on the verified geopolitical event IS publishable as category "analysis". The MSM article count confirms the event is real; the journalist's perspective is the story.
  * geopolitical claims (country attacks military base, assassination, nuclear event) with fewer than 20 mainstream articles — absence of coverage = event did not happen. This applies to non-journalist sources; trusted journalists may still report on verified events.
  * cute animal stories with no news angle
  * policy announcements or press conferences with no incident footage (exception: technology demonstrations showing real breakthroughs in clean energy, food, water, or environmental innovation)
  * stories where the specific location (city/state) cannot be determined from the title or description — if you cannot name a real city and state in the headline, set decision to "reject"; NEVER draft a headline containing words like "unknown", "undetermined", "unclear", or "unspecified". EXCEPTION: if "Trusted Journalist: YES", location is not required — national cases, systemic investigations, and multi-jurisdiction reporting are all valid. The journalist's investigation IS the story.
  * routine local crime with no institutional failure angle — road rage incidents, DUI arrests, shoplifting, bar fights, drunk driving, celebrity legal trouble, general criminal arrests where police acted within standard procedure. These are not "bad", "ugly", or "good" — they are tabloid content. Reject unless police in the footage demonstrate explicit misconduct or the incident meets the "ugly" viral threshold with institutional suppression

APPROVE as needs_review: genuine single-incident US domestic footage — bodycam, security cam, bystander video, local protest, weather event, police incident, political confrontation, consumer/business dispute caught on video

PUBLISH THRESHOLDS:
- Trusted Journalist content: publish if confidence ≥ 0.75 and content is clearly on-topic independent reporting. These voices exist to inform, empower, and advocate — give them the benefit of the doubt.
- Incident footage: publish if confidence > 0.85 and clearly a genuine verifiable US news event
- needs_review if genuine incident or journalist content but confidence falls below publish threshold
- msmGap is true only if fewer than 5 major outlet articles AND the incident involves a powerful institution AND the viral score or view count suggests the story has broad public interest
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
