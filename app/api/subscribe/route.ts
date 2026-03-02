import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check for duplicate
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Already subscribed.' })
  }

  const { error } = await supabase
    .from('subscribers')
    .insert({ email: email.toLowerCase().trim() })

  if (error) {
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Subscribed.' })
}
