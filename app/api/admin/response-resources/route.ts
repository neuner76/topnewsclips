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

  const { id, approval_status, reason_listed, risk_level } = await request.json()

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  if (!['proposed', 'approved', 'rejected', 'retired'].includes(approval_status)) {
    return NextResponse.json({ error: 'Invalid approval status.' }, { status: 400 })
  }
  if (!['low', 'medium', 'high'].includes(risk_level)) {
    return NextResponse.json({ error: 'Invalid risk level.' }, { status: 400 })
  }
  if ((approval_status === 'approved' || approval_status === 'rejected') && (typeof reason_listed !== 'string' || reason_listed.trim().length < 10)) {
    return NextResponse.json({ error: 'Reason listed is required for decisions.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const update: Record<string, unknown> = {
    approval_status,
    reason_listed: typeof reason_listed === 'string' ? reason_listed.trim() : null,
    risk_level,
    updated_at: new Date().toISOString(),
  }
  if (approval_status === 'approved') {
    update.approved_at = new Date().toISOString()
    update.last_reviewed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('verified_response_resources')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
