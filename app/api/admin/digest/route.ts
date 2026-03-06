import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndStoreDigest } from '@/lib/digest'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const digest = await generateAndStoreDigest()
    return NextResponse.json({ success: true, date: digest.date })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
