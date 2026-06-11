import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { id, action, title, description } = await request.json()
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  if (action !== 'publish' && action !== 'discard') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = getSupabase()

  if (action === 'discard') {
    const { data: story, error: fetchErr } = await supabase
      .from('stories')
      .select('slug')
      .eq('id', id)
      .single()

    if (fetchErr || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    await supabase.from('rejected_slugs').upsert({ slug: story.slug, reason: 'qc_hold_discarded' })
    const { error: deleteErr } = await supabase.from('stories').delete().eq('id', id)
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // action === 'publish' — manual editorial override after fixing the held content
  const update: Record<string, unknown> = {
    published: true,
    display_order: 50,
    qc_status: 'pass',
    qc_failed_checks: null,
    updated_at: new Date().toISOString(),
  }
  if (typeof title === 'string' && title.trim()) update.title = title.trim()
  if (typeof description === 'string' && description.trim()) update.description = description.trim()

  const { error } = await supabase.from('stories').update(update).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
