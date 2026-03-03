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
  "headline": "Compelling 10-15 word headline for the story",
  "summary": "2 sentences describing what happened and why it is interesting",
  "msmGap": true or false,
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

REJECT (hard rules — no exceptions):
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best of", "50 biggest", "dash cam compilation")
  * non-English content or stories from India, Pakistan, Bangladesh, or other South Asian countries
  * any international military conflict, missile strike, drone attack, or war footage regardless of view count — these are consistently misinformation on YouTube
  * geopolitical claims (country attacks military base, assassination, nuclear event) with fewer than 20 mainstream articles — absence of coverage = event did not happen
  * cute animal stories with no news angle
  * policy announcements or press conferences with no incident footage

APPROVE as needs_review: genuine single-incident US domestic footage — bodycam, security cam, bystander video, local protest, weather event, police incident, political confrontation, consumer/business dispute caught on video

- publish only if confidence > 0.85 and clearly a genuine verifiable US news event
- msmGap is true if fewer than 5 major outlet articles
- Headlines: factual, specific, name the real location and what happened`

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
      decision: 'reject',
      rejectReason: 'Failed to parse Claude response',
    }
  }
}
