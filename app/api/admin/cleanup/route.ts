import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Called by Vercel cron or GitHub Action — authenticated via CRON_SECRET
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req)
  if (unauthorized) return unauthorized

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('stories')
    .update({ published: false })
    .eq('published', true)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ unpublished: data?.length ?? 0 })
}
