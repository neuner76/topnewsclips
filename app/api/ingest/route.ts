import { NextRequest, NextResponse } from 'next/server'
import { runIngestionPipeline } from '@/lib/ingest/pipeline'
import { requireCronSecret } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req)
  if (unauthorized) return unauthorized

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const result = await runIngestionPipeline()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pipeline failed' },
      { status: 500 }
    )
  }
}
