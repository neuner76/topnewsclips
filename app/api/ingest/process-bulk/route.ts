import { NextResponse } from 'next/server'
import { runProcess } from '@/lib/ingest/pipeline'
import { requireCronSecretOrAdminSession } from '@/lib/auth'

export const maxDuration = 300

export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const batchesParam = Number(url.searchParams.get('batches') ?? 5)
  const batchSizeParam = Number(url.searchParams.get('batchSize') ?? 3)
  const batches = Number.isFinite(batchesParam) ? Math.min(Math.max(batchesParam, 1), 10) : 5
  const batchSize = Number.isFinite(batchSizeParam) ? Math.min(Math.max(batchSizeParam, 1), 10) : 3

  const summary = {
    batchesRun: 0,
    inserted: 0,
    needsReview: 0,
    rejected: 0,
    held: 0,
    errors: [] as string[],
    stories: [] as Array<{ title: string; slug: string; decision: string }>,
  }

  try {
    for (let i = 0; i < batches; i++) {
      const result = await runProcess(batchSize)
      summary.batchesRun++
      summary.inserted += result.inserted
      summary.needsReview += result.needsReview
      summary.rejected += result.rejected
      summary.held += result.held
      summary.errors.push(...result.errors)
      summary.stories.push(...result.stories)

      if (result.errors.includes('No pending candidates in queue — run Fetch first')) break
    }

    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), ...summary },
      { status: 500 }
    )
  }
}
