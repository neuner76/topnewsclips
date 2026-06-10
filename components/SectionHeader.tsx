/**
 * SectionHeader, unified visual header for all homepage sections.
 * Designed to sit inside a SectionCard (dark background).
 */

export type SectionVariant =
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

export const VARIANT_CONFIG: Record<SectionVariant, {
  accent: string
  icon: string
  size: 'lg' | 'sm'
}> = {
  'need-to-know':  { accent: '#3b82f6',  icon: '📌', size: 'lg' },
  'in-the-know':   { accent: '#14b8a6',  icon: '🔍', size: 'lg' },
  'mainstream':    { accent: '#94a3b8',  icon: '📺', size: 'lg' },
  'limited':       { accent: '#ef4444',  icon: '⚠️', size: 'lg' },
  'analysis':      { accent: '#f59e0b',  icon: '🧠', size: 'lg' },
  'reported':      { accent: '#22c55e',  icon: '🔬', size: 'lg' },
  'raw':           { accent: '#94a3b8',  icon: '📹', size: 'lg' },
  'etcetera':      { accent: '#64748b',  icon: '···', size: 'sm' },
}

export default function SectionHeader({ variant, title, subtitle, seeAllHref, seeAllLabel }: SectionHeaderProps) {
  const cfg = VARIANT_CONFIG[variant]
  const isLg = cfg.size === 'lg'

  return (
    <div className="flex items-stretch gap-3 mb-5">
      {/* Colored left accent bar */}
      <div className="w-1 rounded-full shrink-0" style={{ background: cfg.accent, minHeight: 32 }} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={isLg ? 'text-[11px] mr-0.5' : 'text-[10px]'}>{cfg.icon}</span>
          <h2
            className={`font-black tracking-tight uppercase ${isLg ? 'text-xl sm:text-2xl' : 'text-sm'}`}
            style={{ color: cfg.accent }}
          >
            {title}
          </h2>
          {seeAllHref && (
            <a href={seeAllHref} className="text-xs text-white/40 hover:text-white/80 transition-colors font-medium ml-1">
              {seeAllLabel ?? 'See all →'}
            </a>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-white/50 mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
