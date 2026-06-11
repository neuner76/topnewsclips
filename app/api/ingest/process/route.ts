import { NextResponse } from 'next/server'
import { runProcess } from '@/lib/ingest/pipeline'
import { requireCronSecretOrAdminSession } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes — Vercel Pro/Enterprise only; Hobby cap is 60s

export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  try {
    const result = await runProcess()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
