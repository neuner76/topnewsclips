import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('subscribers')
    .delete()
    .eq('email', email.toLowerCase().trim())

  if (error) {
    return NextResponse.json({ error: 'Failed to unsubscribe.' }, { status: 500 })
  }

  // Redirect to a simple confirmation page
  return NextResponse.redirect(new URL('/unsubscribed', req.url))
}
