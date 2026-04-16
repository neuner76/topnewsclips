interface CategoryBadgeProps {
  category: 'raw' | 'reported' | 'analysis' | 'comedy' | null
}

const config: Record<string, { label: string; color: string }> = {
  raw:      { label: 'RAW',      color: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]' },
  reported: { label: 'REPORTED', color: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.94_0.05_145)] border-[oklch(0.84_0.09_145)]' },
  analysis: { label: 'ANALYSIS', color: 'text-[oklch(0.52_0.14_196)] bg-[oklch(0.95_0.04_196)] border-[oklch(0.82_0.08_196)]' },
  comedy:   { label: 'SATIRE',   color: 'text-[oklch(0.48_0.12_85)] bg-[oklch(0.97_0.04_85)] border-[oklch(0.88_0.08_85)]' },
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null
  const entry = config[category]
  if (!entry) return null
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${entry.color}`}>
      {entry.label}
    </span>
  )
}
