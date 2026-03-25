import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeSequence } from '@/lib/email/welcome'

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

  // Fire welcome sequence and surface any error for debugging
  let welcomeError: string | null = null
  try {
    await sendWelcomeSequence(email.toLowerCase().trim())
  } catch (err) {
    welcomeError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ message: 'Subscribed.', welcomeError })
}
