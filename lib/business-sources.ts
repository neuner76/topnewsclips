// Business / markets sources + topic detection. Used to give business a reserved
// processing lane so daily markets clips (CNBC, Bloomberg TV, Yahoo Finance) and
// markets-topic stories from general newsrooms aren't crowded out of the scarce
// processing slots by the politics deluge — the reason the Business & Markets
// digest section runs thin on politics-heavy days.

// Genuine daily markets/finance newsrooms (lowercased handles). Forbes Breaking
// News is intentionally excluded — despite the name it's a politics livestream.
export const BUSINESS_SOURCE_HANDLES = new Set<string>([
  'cnbc',
  'markets', // Bloomberg Television (@markets)
  'yahoofinance',
  'bloombergquicktake', // legacy handle; harmless if it lingers
])

const BUSINESS_SOURCE_SUBSTRINGS = ['cnbc', 'bloomberg', 'yahoo finance']

// Strong markets/finance signals only — deliberately narrow so politics/aid
// stories that merely say "billion" or "company" don't get the business lane.
const MARKETS_TITLE_RE =
  /\b(stock market|stocks|shares|earnings|nasdaq|dow jones|s&p ?500|federal reserve|the fed\b|interest rates?|inflation|\bipo\b|merger|acquisition|bond yields?|wall street|market (?:rally|selloff|sell-off|plunge|surge|crash)|quarterly (?:results|earnings)|\bgdp\b)\b/i

export function isBusinessCandidate(
  journalistUsername?: string | null,
  source?: string | null,
  title?: string | null,
): boolean {
  const handle = (journalistUsername ?? '').toLowerCase()
  if (BUSINESS_SOURCE_HANDLES.has(handle)) return true
  const src = (source ?? '').toLowerCase()
  if (BUSINESS_SOURCE_SUBSTRINGS.some(s => src.includes(s))) return true
  return MARKETS_TITLE_RE.test(title ?? '')
}
