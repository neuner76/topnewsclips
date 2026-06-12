import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { story_slug, story_id, question, email, website } = body as Record<string, unknown>

  if (typeof website === 'string' && website.trim()) {
    return NextResponse.json({ message: 'Submitted.' })
  }

  if (typeof story_slug !== 'string' || !story_slug.trim()) {
    return NextResponse.json({ error: 'Story is required.' }, { status: 400 })
  }
  if (typeof question !== 'string' || question.trim().length < 8) {
    return NextResponse.json({ error: 'Please ask a question with at least 8 characters.' }, { status: 400 })
  }
  if (question.trim().length > 500) {
    return NextResponse.json({ error: 'Question must be 500 characters or fewer.' }, { status: 400 })
  }

  const emailValue = typeof email === 'string' && email.includes('@')
    ? email.toLowerCase().trim()
    : null

  const supabase = await createClient()
  const { error } = await supabase.from('reader_questions').insert({
    story_slug: story_slug.trim(),
    story_id: typeof story_id === 'string' ? story_id : null,
    question: question.trim(),
    email: emailValue,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: 'Could not submit right now. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Submitted.' })
}
