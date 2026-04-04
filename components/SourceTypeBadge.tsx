import Link from 'next/link'

interface SourceTypeBadgeProps {
  tier: number | null
  sourceType: string | null
}

const TIER_STYLES: Record<number, string> = {
  1:  'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]', // green — nonprofit
  2:  'text-[oklch(0.38_0.13_145)] bg-[oklch(0.96_0.03_145)] border-[oklch(0.88_0.07_145)]', // green — OSINT
  3:  'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]', // blue — public broadcaster
  4:  'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]', // blue — independent news
  5:  'text-[oklch(0.45_0.10_230)] bg-[oklch(0.96_0.02_230)] border-[oklch(0.88_0.05_230)]', // blue — wire service
  6:  'text-muted-foreground bg-muted border-border',                                          // neutral — commercial
  7:  'text-muted-foreground bg-muted border-border',                                          // neutral — commentary
  8:  'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]',    // amber — state media
  9:  'text-muted-foreground bg-muted border-border',                                          // neutral — raw footage
  10: 'text-muted-foreground bg-muted border-border',                                          // neutral — community
}

export default function SourceTypeBadge({ tier, sourceType }: SourceTypeBadgeProps) {
  if (!tier || !sourceType) {
    // Show an unclassified badge so readers always know something about the source's status
    return (
      <Link
        href="/taxonomy"
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border transition-opacity hover:opacity-80 text-muted-foreground/60 bg-muted border-border"
        title="Source not yet classified — click to learn about our taxonomy"
      >
        Unclassified
      </Link>
    )
  }

  const style = TIER_STYLES[tier] ?? TIER_STYLES[10]
  const label = tier === 8 ? `⚠ ${sourceType}` : sourceType

  return (
    <Link
      href="/taxonomy"
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border transition-opacity hover:opacity-80 ${style}`}
      title={`Tier ${tier} — click to learn about our source taxonomy`}
    >
      {label}
    </Link>
  )
}
