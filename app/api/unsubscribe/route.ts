import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Unsubscribe token required.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('subscribers')
    .delete()
    .eq('unsubscribe_token', token)

  if (error) {
    return NextResponse.json({ error: 'Failed to unsubscribe.' }, { status: 500 })
  }

  // Redirect to a simple confirmation page
  return NextResponse.redirect(new URL('/unsubscribed', req.url))
}
