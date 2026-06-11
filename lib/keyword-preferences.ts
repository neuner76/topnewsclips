export const MAX_CUSTOM_KEYWORDS = 12

export function normalizeKeywordPhrase(value: string): string {
  const keyword = value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (keyword === 'ai' || keyword === 'a.i.' || keyword === 'a.i') return 'artificial intelligence'
  return keyword
}

export function normalizeKeywordList(values: string[]): string[] {
  return [...new Set(
    values
      .map(normalizeKeywordPhrase)
      .filter(keyword => keyword.length >= 3 && keyword.length <= 80)
  )].slice(0, MAX_CUSTOM_KEYWORDS)
}

export function keywordMatchesText(text: string, keyword: string): boolean {
  const normalizedKeyword = normalizeKeywordPhrase(keyword)
  if (!normalizedKeyword) return false

  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
}
