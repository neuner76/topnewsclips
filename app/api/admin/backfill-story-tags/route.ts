import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecretOrAdminSession } from '@/lib/auth'
import { backfillStoryTags } from '@/lib/story-taxonomy'

export const maxDuration = 300

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  const daysParam = request.nextUrl.searchParams.get('days')
  const days = daysParam ? Number(daysParam) : 14
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 14

  try {
    const result = await backfillStoryTags(getSupabase(), safeDays)
    return NextResponse.json({ ok: true, days: safeDays, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
