import { createHash } from 'crypto'

// Stable content hash for source-item dedupe (§5.2). Truncated sha256 — collision
// risk is negligible for per-source dedupe and it keeps the column short.
export function hashContent(parts: Array<string | number | null | undefined>): string {
  return createHash('sha256').update(parts.map(p => p ?? '').join('|')).digest('hex').slice(0, 32)
}
