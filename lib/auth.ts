import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export function requireCronSecret(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

export async function requireAdminSession(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

// Allows either a scheduled job presenting CRON_SECRET, or a logged-in admin
// triggering the same endpoint from the admin UI.
export async function requireCronSecretOrAdminSession(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null
  }

  return requireAdminSession()
}
