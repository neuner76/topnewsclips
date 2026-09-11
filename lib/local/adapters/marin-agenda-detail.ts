// Marin County agenda detail (Build B/C) — the per-meeting agenda page behind the
// AgendaViewer link (which 302s to GeneratedAgendaViewer.php, server-rendered HTML).
// This deterministic parser turns the numbered agenda rows into AgendaItem[]. The
// LLM enrichment lives in ../agenda-extract.ts; keep this file model-free so it
// stays fully testable offline against the saved fixture.
const UA = 'TopNewsClipsLocal/1.0 (neuner@gmail.com)'

export interface AgendaItem {
  number: string // "1.", "a.", "b." — as printed on the agenda
  text: string
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&lsquo;|&#8216;/g, '‘')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Each agenda row is <td class="numberspace">NUM</td><td>TEXT</td>.
export function parseAgendaItems(html: string): AgendaItem[] {
  const out: AgendaItem[] = []
  const re = /<td class="numberspace">([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const number = clean(m[1])
    const text = clean(m[2])
    if (!text) continue
    out.push({ number, text })
  }
  return out
}

// Deterministic pre-filter: which items are worth an LLM extraction call. An item
// is consequential if it carries a dollar amount, or is a real action request
// (request/approve/award/execute/authorize/adopt/renew a contract/agreement/grant),
// and is not a short procedural placeholder.
const ACTION_RE = /\b(award|execute|authorize|approve|adopt|renew|acquire|amend)\b/i
const SUBJECT_RE = /\b(contract|agreement|grant|lease|purchase|resolution|ordinance|easement|allocation|amendment|appropriat)/i
const PROCEDURAL_RE = /^(call to order|roll call|ceremonial|public comment|adjourn|consent agenda|approval of minutes|closed session|matters?\b)/i

export function isConsequentialItem(item: AgendaItem): boolean {
  const t = item.text
  if (PROCEDURAL_RE.test(t)) return false
  if (/\$\s?\d/.test(t)) return true
  return ACTION_RE.test(t) && SUBJECT_RE.test(t) && t.length > 40
}

export async function fetchAgendaDetail(agendaUrl: string): Promise<AgendaItem[]> {
  const res = await fetch(agendaUrl, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Marin agenda detail HTTP ${res.status}`)
  return parseAgendaItems(await res.text())
}
