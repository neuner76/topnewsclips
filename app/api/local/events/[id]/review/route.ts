import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/auth'
import { reviewEvent, type ReviewAction } from '@/lib/local/review'

// Owner-only: publish or reject a held local event. Session is verified via the
// cookie-based admin auth; the mutation then uses the service client (RLS bypass).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { id } = await params
  let action: ReviewAction
  try {
    const body = (await request.json()) as { action?: string }
    if (body.action !== 'publish' && body.action !== 'reject') {
      return NextResponse.json({ error: 'action must be "publish" or "reject"' }, { status: 400 })
    }
    action = body.action
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const result = await reviewEvent(serviceClient(), id, action)
  if (!result) return NextResponse.json({ error: 'event not found or not held' }, { status: 404 })
  return NextResponse.json({ ok: true, id, state: result })
}
