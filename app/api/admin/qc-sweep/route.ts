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
    const result = await runQCSweep({
      supabase: getSupabase(),
      anthropicKey: process.env.ANTHROPIC_API_KEY!,
      sinceDays: 14,
      dryRun: false,
      source: 'nightly_sweep',
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
