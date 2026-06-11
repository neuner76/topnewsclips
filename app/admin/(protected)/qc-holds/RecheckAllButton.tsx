'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecheckAllButton({ storyIds }: { storyIds: string[] }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  async function runAll() {
    if (!confirm(`Re-check all ${storyIds.length} held stories against the current QC rubric? Items that now PASS will be published automatically.`)) return
    setRunning(true)
    setProgress(0)
    for (const id of storyIds) {
      try {
        await fetch('/api/admin/qc-holds', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'recheck' }),
        })
      } catch {
        // continue with the rest of the queue even if one fails
      }
      setProgress(p => p + 1)
    }
    setRunning(false)
    router.refresh()
  }

  return (
    <button
      onClick={runAll}
      disabled={running}
      className="text-xs font-semibold px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
    >
      {running ? `Re-checking… (${progress}/${storyIds.length})` : `Re-check all ${storyIds.length}`}
    </button>
  )
}
