'use client'

import { useState } from 'react'

// The county permit report can't be deep-linked to a single record, so we make
// the key one-click copyable — paste it into the report's search after clicking
// through. Reliable substitute for URL pre-fill.
export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-[#2563EB] transition-colors"
      aria-label={`Copy ${label ?? 'value'} ${value}`}
    >
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{copied ? '✓ copied' : 'copy'}</span>
    </button>
  )
}
