// NOAA CO-OPS tides adapter — hi/lo predictions -> extremes + next high/low.
import type { TideReading, TideExtreme } from './types'

interface NoaaRaw { predictions?: Array<{ t?: string; v?: string; type?: string }> }

export function normalizeNoaaTides(raw: NoaaRaw, opts: { station: string; now?: Date }): TideReading {
  const extremes: TideExtreme[] = (raw.predictions ?? [])
    .filter(p => p.type === 'H' || p.type === 'L')
    .map(p => ({ type: p.type as 'H' | 'L', time: p.t ?? '', heightFt: Number(p.v ?? 0) }))
  // Prediction times are local ("YYYY-MM-DD HH:MM"); compare lexically against the
  // reference time formatted the same way (both local, so ordering is correct).
  const nowStr = opts.now ? formatLocal(opts.now) : ''
  const after = (e: TideExtreme) => e.time > nowStr
  return {
    station: opts.station,
    extremes,
    nextHigh: extremes.find(e => e.type === 'H' && after(e)),
    nextLow: extremes.find(e => e.type === 'L' && after(e)),
  }
}

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
