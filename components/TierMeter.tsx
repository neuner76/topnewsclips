/**
 * TierMeter, visual credibility signal bars
 *
 * Tier 1 = most trustworthy (10/10 bars, green)
 * Tier 10 = least trustworthy (1/10 bars, red)
 */

interface TierMeterProps {
  tier: number | null
  sourceType: string | null
  sources?: number
  compact?: boolean
}

function getTierColor(tier: number): string {
  if (tier <= 3) return '#22c55e'  // green
  if (tier <= 6) return '#f59e0b'  // amber
  return '#ef4444'                  // red
}

function getBarsFilled(tier: number): number {
  // Tier 1 → 10 bars filled, Tier 10 → 1 bar filled
  return Math.max(1, 11 - tier)
}

export default function TierMeter({ tier, sourceType, sources, compact = false }: TierMeterProps) {
  if (tier === null || sourceType === null) return null

  const color = getTierColor(tier)
  const filled = getBarsFilled(tier)
  const total = 10

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Signal bars, taller bars on the right like a phone signal meter */}
      <span className="inline-flex items-end gap-[2px]" title={`Tier ${tier}: ${sourceType}`}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="rounded-[1px] transition-colors"
            style={{
              width: compact ? 3 : 4,
              height: compact ? (3 + i * 1.2) : (4 + i * 1.5),
              backgroundColor: i < filled ? color : 'rgba(156,163,175,0.3)',
            }}
          />
        ))}
      </span>

      {/* Tier number */}
      {!compact && (
        <span className="text-[10px] font-semibold tracking-wide" style={{ color }}>
          T{tier}
        </span>
      )}

      {/* Source type label */}
      {!compact && (
        <span className="text-[10px] text-muted-foreground">
          {sourceType}
        </span>
      )}

      {/* Source count */}
      {sources !== undefined && sources > 0 && !compact && (
        <>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[10px] text-muted-foreground">{sources} sources</span>
        </>
      )}
    </span>
  )
}
