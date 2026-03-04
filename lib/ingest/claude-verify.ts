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
  category: 'good' | 'bad' | 'ugly'
  subcategory: 'footage' | 'story' | 'discovery' | 'investigation' | 'testimony' | 'pattern'
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
  "headline": "Compelling 10-15 word headline",
  "summary": "2 sentences. Sentence 1: what specifically happened and the specific outcome. Sentence 2: what makes it notable or visually compelling. Never use vague phrases like 'highlights the risks of' or 'raises questions about' — be specific and concrete.",
  "msmGap": true or false,
  "category": "good" or "bad" or "ugly",
  "subcategory": see subcategory rules below,
  "decision": "publish" or "needs_review" or "reject",
  "rejectReason": "reason if rejected, otherwise null"
}

CATEGORY RULES — think like an independent journalist editor, not a viral content aggregator:
- "good": Heroic moments, rescues, acts of courage or community kindness. Firefighters, bystanders, or officers saving lives caught on camera. Also: verified innovative discoveries — scientific breakthroughs, new technologies, clean energy advances, medical innovations, or solutions to food/water/environmental problems from credible sources. When in doubt between "good" and another category, choose "good" if the primary emotion is hope, inspiration, or admiration.
- "bad": Institutional failures the public deserves to know — government corruption, corporate fraud, police misconduct, civil rights violations, abuse of power by institutions. Must be a specific documented incident, not general commentary. A car chase, arrest, or local crime is NOT "bad" unless the clip itself shows documented police misconduct, excessive force, or a civil rights violation — the mere presence of police does not qualify.
- "ugly": Reserved for stories with significant viral reach (500K+ views OR viral score > 70) where mainstream media coverage is absent or minimal despite the story clearly mattering at a national or systemic level. The silence must be suspicious — i.e., the story involves a powerful institution (government, police department, corporation, political figure) that has a motive to suppress it. A local incident simply not covered by national media is NOT "ugly" — it's just local. The combination of viral reach + institutional subject + media silence = "ugly".

SUBCATEGORY RULES — choose the one that best fits:
- "footage": raw caught-on-camera video — bodycam, security cam, bystander clip, dashcam
- "story": documented hero story, rescue narrative, community achievement (may include interview elements)
- "discovery": scientific breakthrough, innovation, clean energy, technology advance (talking head OK)
- "investigation": investigative journalist reporting, documented institutional exposé, in-depth reporting
- "testimony": whistleblower, survivor account, firsthand witness, person speaking directly to camera about what they experienced
- "pattern": documented systemic issue showing a repeated or ongoing institutional failure

TRUSTED JOURNALIST EXCEPTION — if "Trusted Journalist: YES":
A new post from a trusted curated journalist is news, even without incident footage. Talking head interviews, opinion pieces, and investigative commentary from these sources ARE publishable content. Apply these relaxed rules:
- Location requirement is WAIVED — they may report on national or systemic issues
- Incident footage requirement is WAIVED — their perspective and reporting IS the story
- Assign subcategory "story", "discovery", "investigation", or "testimony" as appropriate
- Still reject if content is clearly off-topic (entertainment, personal lifestyle, self-promotion unrelated to news or public interest)
- Set confidence to 0.9 if the content is clearly on-topic reporting from the journalist

REJECT (hard rules — no exceptions):
  * pornographic/gore, spam/scam, fictional entertainment (movie trailer, game clip)
  * compilation of multiple clips ("top 10", "best of", "50 biggest", "dash cam compilation")
  * non-English content or stories from outside the United States — this includes UK (England, Scotland, Wales, Northern Ireland), Canada, Australia, India, Pakistan, Bangladesh, and all other non-US countries. Specific tell-tale signs: UK locations (London, Sheffield, Manchester, Birmingham, Leeds, Bristol, Liverpool, Glasgow, Edinburgh, Cardiff, any mention of "Road" suffixed UK street names like "London Road"), references to police as "officers" responding under UK forces, NHS, etc.
  * any international military conflict, missile strike, drone attack, or war footage regardless of view count — these are consistently misinformation on YouTube
  * geopolitical claims (country attacks military base, assassination, nuclear event) with fewer than 20 mainstream articles — absence of coverage = event did not happen
  * cute animal stories with no news angle
  * policy announcements or press conferences with no incident footage (exception: technology demonstrations showing real breakthroughs in clean energy, food, water, or environmental innovation)
  * stories where the specific location (city/state) cannot be determined from the title or description — if you cannot name a real city and state in the headline, set decision to "reject"; NEVER draft a headline containing words like "unknown", "undetermined", "unclear", or "unspecified"
  * routine local crime with no institutional failure angle — road rage incidents, DUI arrests, shoplifting, bar fights, drunk driving, celebrity legal trouble, general criminal arrests where police acted within standard procedure. These are not "bad", "ugly", or "good" — they are tabloid content. Reject unless police in the footage demonstrate explicit misconduct or the incident meets the "ugly" viral threshold with institutional suppression

APPROVE as needs_review: genuine single-incident US domestic footage — bodycam, security cam, bystander video, local protest, weather event, police incident, political confrontation, consumer/business dispute caught on video

- publish only if confidence > 0.85 and it is clearly a genuine verifiable US news event or on-topic journalist content
- needs_review if genuine incident or journalist content but confidence is 0.7–0.85
- msmGap is true only if fewer than 5 major outlet articles AND the incident involves a powerful institution AND the viral score or view count suggests the story has broad public interest
- Headlines for incident footage: must name the real city/state and the specific incident — no vague titles
- Headlines for journalist content (subcategory story/discovery/investigation/testimony): name the journalist's topic and key claim — location optional`

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
      subcategory: 'footage' as const,
      decision: 'reject',
      rejectReason: 'Failed to parse Claude response',
    }
  }
}
