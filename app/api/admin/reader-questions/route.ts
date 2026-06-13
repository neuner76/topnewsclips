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

  const { id, status, moderation_notes } = await request.json()
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  if (!['pending', 'approved', 'rejected', 'answered', 'archived'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from('reader_questions')
    .update({
      status,
      moderation_notes: typeof moderation_notes === 'string' ? moderation_notes : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
