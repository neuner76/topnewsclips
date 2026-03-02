'use client'

import { useState } from 'react'

export default function IngestButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

  async function handleIngest() {
    setStatus('running')
    setResult(null)
    try {
      const res = await fetch('/api/ingest')
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResult(data.error ?? 'Unknown error')
      } else {
        const errStr = data.errors?.length ? ` | ${data.errors.join('; ')}` : ''
        setStatus('done')
        setResult(`+${data.inserted} drafts, +${data.needsReview} review, ${data.rejected} rejected${errStr}`)
      }
    } catch {
      setStatus('error')
      setResult('Network error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleIngest}
        disabled={status === 'running'}
        className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'running' ? '⏳ Running...' : '⚡ Run Ingest'}
      </button>
      {result && (
        <span className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {result}
        </span>
      )}
    </div>
  )
}
