import { NextResponse } from 'next/server'
import { runFetch } from '@/lib/ingest/pipeline'
import { requireCronSecret } from '@/lib/auth'

export const maxDuration = 300 // 5 minutes — Vercel Pro/Enterprise only; Hobby cap is 60s

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  try {
    const result = await runFetch()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
