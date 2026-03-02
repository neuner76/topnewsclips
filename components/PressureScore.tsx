import { Eye, Share2 } from 'lucide-react'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

interface PressureScoreProps {
  viewCount: number
  shareCount: number
}

export default function PressureScore({ viewCount, shareCount }: PressureScoreProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Eye className="w-3.5 h-3.5" />
        {formatCount(viewCount)}
      </span>
      <span className="flex items-center gap-1">
        <Share2 className="w-3.5 h-3.5" />
        {formatCount(shareCount)}
      </span>
    </div>
  )
}
