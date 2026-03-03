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

  const prompt = `You are a content curator for TopNewsClips.com, which surfaces interesting viral videos and news stories.

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
  "summary": "2 sentences describing the content and why it is interesting or newsworthy",
  "msmGap": true or false,
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

Decision rules:
- reject if ANY of:
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best moments", "dash cam compilation", "50 biggest")
  * non-English content or South Asian regional stories (India, Pakistan, Bangladesh — look for city names, lakhs/crore/rupees)
  * EXTRAORDINARY geopolitical claims (country attacks US military base, assassination of world leader, nuclear strike) with fewer than 10 mainstream news articles — for these claims, absence of coverage means the event DID NOT HAPPEN, not that it's suppressed
  * any claim involving Iran, Russia, or other adversaries attacking US military installations unless confirmed by 10+ mainstream sources
  * policy/bureaucratic announcements with no viral footage
- needs_review for genuine real-world events: local incidents, caught-on-camera moments, domestic US news, minor political incidents
- publish only if clearly a genuine viral news event with confidence > 0.85
- msmGap is true if fewer than 5 major outlet articles cover this — but for extraordinary geopolitical claims, low coverage = likely fake, not suppressed
- Headlines should be factual and specific (name real locations, people, incidents)`

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
