/**
 * SectionHeader — unified visual header for all homepage sections
 *
 * Each section gets:
 * - A colored left accent bar tied to its identity
 * - An icon/emoji
 * - Title + subtitle
 * - Optional "see all" link
 *
 * Variants:
 *   need-to-know   → electric blue, bold
 *   in-the-know    → teal
 *   mainstream     → neutral/muted
 *   limited        → red/warning
 *   analysis       → amber
 *   reported       → green
 *   raw            → slate
 *   etcetera       → muted, small
 */

type SectionVariant =
  | 'need-to-know'
  | 'in-the-know'
  | 'mainstream'
  | 'limited'
  | 'analysis'
  | 'reported'
  | 'raw'
  | 'etcetera'

interface SectionHeaderProps {
  variant: SectionVariant
  title: string
  subtitle?: string
  seeAllHref?: string
  seeAllLabel?: string
}

const VARIANT_CONFIG: Record<SectionVariant, {
  accent: string      // left bar color
  titleColor: string  // title text color
  icon: string
  size: 'lg' | 'sm'
}> = {
  'need-to-know':  { accent: '#3b82f6', titleColor: '#3b82f6', icon: '📌', size: 'lg' },
  'in-the-know':   { accent: 'oklch(0.52 0.14 196)', titleColor: 'oklch(0.52 0.14 196)', icon: '🔍', size: 'lg' },
  'mainstream':    { accent: 'oklch(0.556 0 0)', titleColor: 'oklch(0.556 0 0)', icon: '📺', size: 'lg' },
  'limited':       { accent: '#ef4444', titleColor: '#ef4444', icon: '⚠️', size: 'lg' },
  'analysis':      { accent: '#f59e0b', titleColor: '#f59e0b', icon: '🧠', size: 'lg' },
  'reported':      { accent: '#22c55e', titleColor: '#22c55e', icon: '🔬', size: 'lg' },
  'raw':           { accent: 'oklch(0.556 0 0)', titleColor: 'currentColor', icon: '📹', size: 'lg' },
  'etcetera':      { accent: 'oklch(0.7 0 0)', titleColor: 'oklch(0.556 0 0)', icon: '···', size: 'sm' },
}

export default function SectionHeader({ variant, title, subtitle, seeAllHref, seeAllLabel }: SectionHeaderProps) {
  const cfg = VARIANT_CONFIG[variant]
  const isLg = cfg.size === 'lg'

  return (
    <div
      className="flex items-stretch gap-3 mb-4"
    >
      {/* Colored left accent bar */}
      <div
        className="w-1 rounded-full shrink-0"
        style={{ background: cfg.accent, minHeight: 32 }}
      />

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={isLg ? 'text-[11px] mr-1' : 'text-[10px] mr-0.5'}>{cfg.icon}</span>
          <h2
            className={`font-black tracking-tight uppercase ${isLg ? 'text-xl sm:text-2xl' : 'text-sm'}`}
            style={{ color: cfg.titleColor }}
          >
            {title}
          </h2>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium ml-1"
            >
              {seeAllLabel ?? 'See all →'}
            </a>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
