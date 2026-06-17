import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecretOrAdminSession } from '@/lib/auth'
import { runQCSweep } from '@/lib/ingest/qc-sweep'

export const maxDuration = 300 // 5 minutes — Vercel Pro/Enterprise only; Hobby cap is 60s

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Nightly QC reconciliation sweep — re-checks published stories from the
// trailing 14 days against the QC rubric. High-confidence FIX cases (C1/C2)
// are auto-applied; everything else routes to the existing /admin/qc-holds queue.
export async function GET(request: Request) {
  const unauthorized = await requireCronSecretOrAdminSession(request)
  if (unauthorized) return unauthorized

  try {
    // Bounded batch per run — one LLM call per story can't fit the whole
    // 14-day window in a single request. ?limit= overrides for manual runs.
    const url = new URL(request.url)
    const limitParam = Number(url.searchParams.get('limit'))
    const maxStories = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 40

    const result = await runQCSweep({
      supabase: getSupabase(),
      anthropicKey: process.env.ANTHROPIC_API_KEY!,
      sinceDays: 14,
      dryRun: false,
      source: 'nightly_sweep',
      maxStories,
    })

    // Structured response (spec 1.2) the CI workflow (1.1) can consume:
    //  - swept   = stories scanned this batch
    //  - flagged = stories that need human attention (held — the page-Eric signal)
    //  - failures = every non-PASS story with the rubric checks it failed
    // The original fields are preserved for the admin holds UI.
    const failures = result.results
      .filter(r => r.verdict !== 'PASS')
      .map(r => ({ slug: r.slug, verdict: r.verdict, checks_failed: r.failedChecks.map(c => c.id) }))

    return NextResponse.json({
      ...result,
      swept: result.scanned,
      flagged: result.held,
      autoFixed: result.autoFixed,
      failures,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
