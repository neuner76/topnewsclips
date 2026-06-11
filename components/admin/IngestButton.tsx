'use client'

import { useState } from 'react'

type Phase = 'idle' | 'running' | 'done' | 'error'

export default function IngestButton() {
  const [fetchPhase, setFetchPhase] = useState<Phase>('idle')
  const [processPhase, setProcessPhase] = useState<Phase>('idle')
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)
  const [processMsg, setProcessMsg] = useState<string | null>(null)

  async function handleFetch() {
    setFetchPhase('running')
    setFetchMsg(null)
    try {
      const res = await fetch('/api/ingest/fetch')
      const data = await res.json()
      if (!res.ok) {
        setFetchPhase('error')
        setFetchMsg(data.error ?? 'Unknown error')
      } else {
        const errStr = data.errors?.length ? ` | ${data.errors.join('; ')}` : ''
        setFetchPhase('done')
        setFetchMsg(`+${data.added} queued${errStr}`)
      }
    } catch {
      setFetchPhase('error')
      setFetchMsg('Network error')
    }
  }

  async function handleProcess() {
    setProcessPhase('running')
    setProcessMsg(null)
    try {
      const res = await fetch('/api/ingest/process')
      const data = await res.json()
      if (!res.ok) {
        setProcessPhase('error')
        setProcessMsg(data.error ?? 'Unknown error')
      } else {
        const errStr = data.errors?.length ? ` | ${data.errors.join('; ')}` : ''
        setProcessPhase('done')
        setProcessMsg(`+${data.inserted} drafts, +${data.needsReview} review, ${data.rejected} rejected${errStr}`)
      }
    } catch {
      setProcessPhase('error')
      setProcessMsg('Network error')
    }
  }

  async function handleProcessBulk() {
    setProcessPhase('running')
    setProcessMsg(null)
    try {
      const res = await fetch('/api/ingest/process-bulk?batches=3&batchSize=3')
      const data = await res.json()
      if (!res.ok) {
        setProcessPhase('error')
        setProcessMsg(data.error ?? 'Unknown error')
      } else {
        const errStr = data.errors?.length ? ` | ${data.errors.join('; ')}` : ''
        setProcessPhase('done')
        setProcessMsg(`${data.batchesRun} batches: +${data.inserted} drafts, +${data.needsReview} review, ${data.held} hold, ${data.rejected} rejected${errStr}`)
      }
    } catch {
      setProcessPhase('error')
      setProcessMsg('Network error')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={handleFetch}
          disabled={fetchPhase === 'running'}
          className="inline-flex items-center gap-1 bg-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {fetchPhase === 'running' ? '⏳ Fetching...' : '⬇ Fetch'}
        </button>
        <button
          onClick={handleProcess}
          disabled={processPhase === 'running'}
          className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {processPhase === 'running' ? '⏳ Processing...' : '⚡ Process'}
        </button>
        <button
          onClick={handleProcessBulk}
          disabled={processPhase === 'running'}
          className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {processPhase === 'running' ? '⏳ Processing...' : '⚡ Process 9'}
        </button>
      </div>
      {fetchMsg && (
        <span className={`text-xs ${fetchPhase === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
          Fetch: {fetchMsg}
        </span>
      )}
      {processMsg && (
        <span className={`text-xs ${processPhase === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          Process: {processMsg}
        </span>
      )}
    </div>
  )
}
