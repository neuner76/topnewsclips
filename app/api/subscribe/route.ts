import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeSequence } from '@/lib/email/welcome'

function generateReferralCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}

export async function POST(req: NextRequest) {
  const { email, ref } = await req.json()

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const supabase = await createClient()

  // Check for duplicate
  const { data: existing } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', normalizedEmail)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Already subscribed.' })
  }

  const referralCode = generateReferralCode()

  // Validate the referring code exists before storing it
  let referredBy: string | null = null
  if (ref && typeof ref === 'string') {
    const { data: referrer } = await supabase
      .from('subscribers')
      .select('referral_code')
      .eq('referral_code', ref.toUpperCase())
      .single()
    if (referrer) referredBy = ref.toUpperCase()
  }

  const { error } = await supabase
    .from('subscribers')
    .insert({ email: normalizedEmail, referral_code: referralCode, referred_by: referredBy })

  if (error) {
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 })
  }

  await sendWelcomeSequence(normalizedEmail, referralCode).catch(() => {})

  return NextResponse.json({ message: 'Subscribed.' })
}
