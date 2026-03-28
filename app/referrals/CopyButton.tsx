'use client'

import { useState } from 'react'

export default function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs font-semibold px-3 py-2 rounded border border-border hover:bg-muted transition-colors"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
