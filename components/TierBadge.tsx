/**
 * TierBadge — calm, descriptive source label.
 *
 * Source type is first. Tier number is secondary.
 * Three bands only: high / mid / low.
 * Designed to feel neutral and informative, not like a ranking or warning.
 *
 * Band mapping:
 *   high  T1–T3  Nonprofit Investigative, OSINT, Public Broadcaster
 *   mid   T4–T6  Independent News, Wire Service, Commercial Newsroom
 *   low   T7–T10 Independent Commentary, State Media, Raw Footage, Community
 */

interface TierBadgeProps {
  tier: number | null
  sourceType: string | null
  compact?: boolean
}

type Band = 'high' | 'mid' | 'low'

function getBand(tier: number): Band {
  if (tier <= 3) return 'high'
  if (tier <= 6) return 'mid'
  return 'low'
}

// Adapted for dark navy backgrounds
const BAND_STYLES: Record<Band, {
  bar: string         // bar color + height class
  bg: string
  border: string
  labelColor: string
  tierColor: string
}> = {
  high: {
    bar: 'bg-slate-300 h-4',
    bg: 'rgba(226,232,240,0.1)',
    border: 'rgba(226,232,240,0.2)',
    labelColor: '#e2e8f0',
    tierColor: 'rgba(226,232,240,0.5)',
  },
  mid: {
    bar: 'bg-slate-500 h-3.5',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.2)',
    labelColor: '#94a3b8',
    tierColor: 'rgba(148,163,184,0.5)',
  },
  low: {
    bar: 'bg-slate-600 h-3',
    bg: 'rgba(100,116,139,0.06)',
    border: 'rgba(100,116,139,0.18)',
    labelColor: '#64748b',
    tierColor: 'rgba(100,116,139,0.5)',
  },
}

// Shorten long source type labels for compact display
const SHORT_LABELS: Record<string, string> = {
  'Nonprofit Investigative':         'Investigative',
  'Public Broadcaster':              'Public Media',
  'Independent News':                'Ind. News',
  'Wire Service':                    'Wire',
  'Commercial Newsroom':             'Newsroom',
  'Commercial Newsroom (Satire)':    'Satire',
  'Independent Commentary':          'Commentary',
  'Independent Commentary (Satire)': 'Satire',
  'State Media':                     'State Media',
  'Raw Footage':                     'Raw',
  'Community Sourced':               'Community',
  'Mainstream Pulse':                'Newsroom',
}

export default function TierBadge({ tier, sourceType, compact = false }: TierBadgeProps) {
  if (!tier || !sourceType) return null

  const band = getBand(tier)
  const styles = BAND_STYLES[band]
  const label = compact
    ? (SHORT_LABELS[sourceType] ?? sourceType)
    : (SHORT_LABELS[sourceType] ?? sourceType)
  const tierLabel = `T${tier}`

  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Vertical bar — height signals band level */}
      <span
        className={`w-1.5 rounded-full shrink-0 ${styles.bar}`}
      />

      {/* Pill */}
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{
          background: styles.bg,
          border: `1px solid ${styles.border}`,
          color: styles.labelColor,
        }}
        title={`${sourceType} (Tier ${tier})`}
      >
        <span>{label}</span>
        <span style={{ color: styles.tierColor }}>·</span>
        <span style={{ color: styles.tierColor }}>{tierLabel}</span>
      </span>
    </span>
  )
}
