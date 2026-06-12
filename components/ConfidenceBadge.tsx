import Link from 'next/link'
import { CONFIDENCE_META, type ConfidenceLabel } from '@/lib/confidence'

const BADGE_CLASS = 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border transition-opacity hover:opacity-80'

// Confidence labels are reserved for news content. Satire/comedy shows a
// "Cultural lens" content-type badge instead — pass `category` so the rule
// is enforced here once, not per template.
export default function ConfidenceBadge({ label, category }: { label: ConfidenceLabel | null; category?: string | null }) {
  if (category === 'comedy') {
    return (
      <Link
        href="/taxonomy"
        className={`${BADGE_CLASS} text-muted-foreground bg-muted border-border italic`}
        title="Satire and commentary — a cultural lens on the news, not fact reporting"
      >
        Cultural lens
      </Link>
    )
  }

  if (!label) return null

  const meta = CONFIDENCE_META[label]
  return (
    <Link
      href="/taxonomy#confidence"
      className={`${BADGE_CLASS} ${meta.className} ${meta.italic ? 'italic' : ''}`}
      title={meta.description}
    >
      {meta.label}
    </Link>
  )
}
