interface CategoryBadgeProps {
  category: 'raw' | 'reported' | 'analysis' | null
}

const config = {
  raw:      { label: 'RAW',      color: 'text-neutral-600 bg-neutral-100 border-neutral-300' },
  reported: { label: 'REPORTED', color: 'text-[oklch(0.38_0.13_145)] bg-[oklch(0.94_0.05_145)] border-[oklch(0.84_0.09_145)]' },
  analysis: { label: 'ANALYSIS', color: 'text-[oklch(0.45_0.22_24)] bg-[oklch(0.96_0.03_24)] border-[oklch(0.88_0.06_24)]' },
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null
  const { label, color } = config[category]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${color}`}>
      {label}
    </span>
  )
}
