import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// One-time backfill: regenerate summaries for stories with short descriptions (<200 chars)
// GET /api/admin/backfill-summaries?secret=CRON_SECRET&dry=true   → preview count
// GET /api/admin/backfill-summaries?secret=CRON_SECRET            → run (max 20 per call)

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dry = req.nextUrl.searchParams.get('dry') === 'true'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, title, description, platform, region')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fallback: PostgREST doesn't support .length filter — filter in JS
  const shortStories = (stories ?? []).filter(s => (s.description ?? '').length < 200)

  if (dry) {
    return NextResponse.json({ count: shortStories.length, titles: shortStories.map(s => s.title) })
  }

  const results: { id: string; title: string; newLength: number; ok: boolean }[] = []

  for (const story of shortStories) {
    try {
      const isGlobal = !!story.region
      const prompt = isGlobal
        ? `Write a 3-4 sentence summary (20-30 words per sentence) for this international news story. Sentence 1: what happened, where, who was involved — specific names, places, numbers. Sentence 2: the immediate consequence or scale. Sentence 3: why it matters to the wider world or Americans. Sentence 4 (optional): context or what happens next. Write as a standalone paragraph. Return only the summary text, no JSON, no labels.\n\nTitle: ${story.title}`
        : `Write a 3-4 sentence summary (20-30 words per sentence) for this news story. Sentence 1: what happened, who was involved, where — specific names, places, numbers. Sentence 2: the immediate consequence or scale of the event. Sentence 3: what this means for ordinary people or why it matters. Sentence 4 (optional): context or what happens next. Write as a standalone paragraph. Return only the summary text, no JSON, no labels.\n\nTitle: ${story.title}`

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const newSummary = (msg.content[0] as { type: string; text: string }).text.trim()

      await supabase
        .from('stories')
        .update({ description: newSummary })
        .eq('id', story.id)

      results.push({ id: story.id, title: story.title.slice(0, 60), newLength: newSummary.length, ok: true })
    } catch (err) {
      results.push({ id: story.id, title: story.title.slice(0, 60), newLength: 0, ok: false })
    }

    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({ updated: results.filter(r => r.ok).length, results })
}
