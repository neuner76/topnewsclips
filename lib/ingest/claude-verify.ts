import Anthropic from '@anthropic-ai/sdk'

export interface ClipInput {
  title: string
  description: string
  platform: string
  source: string
  viralScore: number
  msmArticleCount: number
  msmGap: boolean
}

export interface VerificationResult {
  isRealEvent: boolean
  confidence: number
  aiGeneratedRisk: 'low' | 'medium' | 'high'
  headline: string
  summary: string
  msmGap: boolean
  category: 'good' | 'bad' | 'ugly'
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

The IDEAL content: bodycam footage, security camera incidents, bystander video, local police/weather/protest events, town hall confrontations, quirky local US news. Single real incidents filmed by witnesses or cameras.

Analyze this video/story and respond with valid JSON only (no markdown, no explanation):

CLIP DATA:
Title: ${clip.title}
Description: ${clip.description.slice(0, 400)}
Platform: ${clip.platform}
Source: ${clip.source}
Viral Score: ${clip.viralScore}
Mainstream Media Articles Found: ${clip.msmArticleCount === -1 ? 'unknown' : clip.msmArticleCount}

Respond with this exact JSON structure:
{
  "isRealEvent": true or false,
  "confidence": 0.0 to 1.0,
  "aiGeneratedRisk": "low" or "medium" or "high",
  "headline": "Compelling 10-15 word headline naming the specific location and what happened",
  "summary": "2 sentences. Sentence 1: what specifically happened, naming the city/state and specific outcome (injuries, arrests, damage). Sentence 2: what makes it notable or visually compelling. Never use vague phrases like 'highlights the risks of' or 'raises questions about' — be specific and concrete.",
  "msmGap": true or false,
  "category": "good" or "bad" or "ugly",
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

CATEGORY RULES — think like an independent journalist editor, not a viral content aggregator:
- "good": Heroic moments, rescues, acts of courage or community kindness that deserve amplification. Also: verified breakthroughs in clean energy, food technology, water access, or environmental solutions from credible independent sources.
- "bad": Institutional failures the public deserves to know — government corruption, corporate fraud, police misconduct, civil rights violations, abuse of power by institutions. Must be a specific documented incident, not general commentary.
- "ugly": Stories that independent journalists are covering but mainstream media is ignoring or actively suppressing. If msmGap=true and the incident is real and documented, this is almost always "ugly". The gap between viral reach and MSM silence IS the story.

REJECT (hard rules — no exceptions):
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best of", "50 biggest", "dash cam compilation")
  * non-English content or stories from outside the United States — this includes UK (England, Scotland, Wales, Northern Ireland), Canada, Australia, India, Pakistan, Bangladesh, and all other non-US countries. Specific tell-tale signs: UK locations (London, Sheffield, Manchester, Birmingham, Leeds, Bristol, Liverpool, Glasgow, Edinburgh, Cardiff, any mention of "Road" suffixed UK street names like "London Road"), references to police as "officers" responding under UK forces, NHS, etc.
  * any international military conflict, missile strike, drone attack, or war footage regardless of view count — these are consistently misinformation on YouTube
  * geopolitical claims (country attacks military base, assassination, nuclear event) with fewer than 20 mainstream articles — absence of coverage = event did not happen
  * cute animal stories with no news angle
  * policy announcements or press conferences with no incident footage (exception: technology demonstrations showing real breakthroughs in clean energy, food, water, or environmental innovation)
  * stories where the specific location (city/state) cannot be determined from the title or description

APPROVE as needs_review: genuine single-incident US domestic footage — bodycam, security cam, bystander video, local protest, weather event, police incident, political confrontation, consumer/business dispute caught on video

- publish only if confidence > 0.85, location is known, and it is clearly a genuine verifiable US news event
- needs_review if genuine incident but location is uncertain or confidence is 0.7–0.85
- msmGap is true only if fewer than 5 major outlet articles AND the incident details are specific and verifiable
- Headlines: must name the real city/state and the specific incident — no vague titles`

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
      category: 'bad' as const,
      decision: 'reject',
      rejectReason: 'Failed to parse Claude response',
    }
  }
}
