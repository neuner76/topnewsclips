'use client'

import { useState } from 'react'

// The county permit lookup can't be deep-linked to a single permit, so we make
// the number one-click copyable — paste it into the county search after clicking
// through. Reliable substitute for URL pre-fill.
export function CopyPermitNumber({ permitNumber }: { permitNumber: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(permitNumber)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-[#2563EB] transition-colors"
      aria-label={`Copy permit number ${permitNumber}`}
    >
      <span className="font-medium tabular-nums">{permitNumber}</span>
      <span className="text-[11px] text-muted-foreground">{copied ? '✓ copied' : 'copy'}</span>
    </button>
  )
}
