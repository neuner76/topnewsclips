/**
 * SourceBadge — neutral source-type label.
 *
 * Replaces TierMeter. Shows what KIND of source something is,
 * without implying a trustworthiness ranking via color.
 *
 * Tiers describe editorial process, not credibility score:
 *   1 = Nonprofit Investigative   6 = Commercial Newsroom
 *   2 = OSINT                     7 = Independent Commentary
 *   3 = Public Broadcaster        8 = State Media
 *   4 = Independent News          9 = Raw Footage
 *   5 = Wire Service             10 = Community Sourced
 */

interface SourceBadgeProps {
  tier: number | null
  sourceType: string | null
  compact?: boolean
}

interface BadgeConfig {
  icon: string
  label: string
  color: string      // subtle, non-judgmental
  bg: string
  border: string
}

const BADGE_CONFIG: Record<string, BadgeConfig> = {
  'Nonprofit Investigative':           { icon: '🔬', label: 'Investigative',   color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.2)' },
  'OSINT':                             { icon: '🛰️',  label: 'OSINT',           color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
  'Public Broadcaster':                { icon: '📡', label: 'Public Media',    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)' },
  'Independent News':                  { icon: '📰', label: 'Ind. News',       color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)' },
  'Wire Service':                      { icon: '🔗', label: 'Wire Service',    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  'Commercial Newsroom':               { icon: '🏢', label: 'Newsroom',        color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  'Commercial Newsroom (Satire)':      { icon: '🎭', label: 'Satire',          color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
  'Independent Commentary':            { icon: '💬', label: 'Commentary',      color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
  'Independent Commentary (Satire)':   { icon: '🎭', label: 'Satire',          color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
  'State Media':                       { icon: '🏛️',  label: 'State Media',    color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)' },
  'Raw Footage':                       { icon: '📹', label: 'Raw Footage',     color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  'Community Sourced':                 { icon: '👥', label: 'Community',       color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  'Mainstream Pulse':                  { icon: '🏢', label: 'Newsroom',        color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
}

const FALLBACK: BadgeConfig = {
  icon: '📄', label: 'Source', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',
}

export default function SourceBadge({ tier, sourceType, compact = false }: SourceBadgeProps) {
  if (!sourceType) return null

  const cfg = BADGE_CONFIG[sourceType] ?? FALLBACK
  const label = compact ? cfg.icon : `${cfg.icon} ${cfg.label}`

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-semibold tracking-wide whitespace-nowrap"
      style={{
        fontSize: compact ? 10 : 11,
        padding: compact ? '1px 5px' : '2px 7px',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
      title={`${sourceType}${tier ? ` (Tier ${tier})` : ''}`}
    >
      {label}
    </span>
  )
}
