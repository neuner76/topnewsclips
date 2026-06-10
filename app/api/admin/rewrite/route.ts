import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdminSession } from '@/lib/auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { storyId } = await request.json()
  if (!storyId) return NextResponse.json({ error: 'Missing storyId' }, { status: 400 })

  const supabase = getSupabase()
  const { data: story, error: fetchErr } = await supabase
    .from('stories')
    .select('id, title, description, category, journalist_username, msm_gap, platform')
    .eq('id', storyId)
    .single()

  if (fetchErr || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const isJournalist = !!story.journalist_username
  const categoryHint =
    story.category === 'raw'
      ? 'This is raw footage — a real incident caught on camera.'
      : story.category === 'reported'
      ? 'This is reported journalism — a journalist investigated and documented this.'
      : 'This is analysis — an independent voice explaining what is happening and why.'

  const prompt = `You are an editor for TopNewsClips.com, a site that surfaces stories mainstream media undercovers. Your job is to rewrite headlines and descriptions so readers immediately understand what happened AND why it matters to them.

${categoryHint}
${isJournalist ? `Source: Independent journalist @${story.journalist_username}` : ''}
${story.msm_gap ? 'Note: This story has received little or no mainstream media coverage.' : ''}

Current headline: ${story.title}
Current description: ${story.description || '(none)'}

Rewrite both for a curious citizen who wants to understand what's happening in their country. Respond with valid JSON only:

{
  "headline": "10-15 words. Lead with the most newsworthy fact. Make the reader feel the stakes. No passive voice. Never mention the journalist's name, channel name, or outlet name — the story is the story, not the messenger.",
  "description": "2 sentences, maximum 25 words each. Sentence 1: what specifically happened, where, and who is affected — name real people, institutions, or places. Sentence 2: why this matters to ordinary people — safety, rights, money, accountability, or civic life. Be direct and concrete. Never editorialize or use politically charged language like 'authoritarian', 'extremist', 'radical', or 'alarming'. Never use 'highlights', 'raises questions', 'sparks debate', or any phrase that softens facts. Must be informative to citizens of any political affiliation."
}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let rewritten: { headline: string; description: string }
  try {
    rewritten = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response' }, { status: 500 })
  }

  const { error: updateErr } = await supabase
    .from('stories')
    .update({
      title: rewritten.headline,
      description: rewritten.description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storyId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ title: rewritten.headline, description: rewritten.description })
}
