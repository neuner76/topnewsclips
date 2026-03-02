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

Decision rules — be VERY generous, default to needs_review:
- reject ONLY if: clearly pornographic, violent gore, spam/scam, or completely fictional entertainment (movie trailer, game clip)
- needs_review for everything else — a human will approve before publishing
- publish only if it is clearly a genuine real-world news event with confidence > 0.85
- When in doubt, use needs_review, not reject
- msmGap is true if fewer than 5 major outlet articles cover this
- Headlines should be factual and descriptive`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

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
