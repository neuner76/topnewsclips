import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseAgendaItems, isConsequentialItem } from './marin-agenda-detail'

const fixture = fs.readFileSync(
  path.join('fixtures', 'sources', 'marin-agenda-detail', 'sample.html'),
  'utf8',
)

describe('parseAgendaItems', () => {
  const items = parseAgendaItems(fixture)

  it('parses every numbered agenda row', () => {
    expect(items.length).toBeGreaterThanOrEqual(25)
    expect(items.every(i => i.number && i.text)).toBe(true)
  })

  it('captures the full text of a contract item, including dollar amounts', () => {
    const vets = items.find(i => i.text.includes('Veterans'))
    expect(vets).toBeDefined()
    expect(vets!.text).toContain('$247,700')
    expect(vets!.text).toContain('Topline Welding')
  })

  it('keeps procedural items too (parser is neutral)', () => {
    expect(items.some(i => /call to order/i.test(i.text))).toBe(true)
  })
})

describe('isConsequentialItem', () => {
  it('flags items that carry a dollar amount', () => {
    expect(isConsequentialItem({ number: 'b.', text: 'Award a contract in the amount of $247,700.' })).toBe(true)
  })

  it('flags action items even without a dollar amount', () => {
    expect(isConsequentialItem({ number: 'a.', text: 'Request from Parks to approve and execute 28 grant agreements.' })).toBe(true)
  })

  it('skips pure procedural boilerplate', () => {
    expect(isConsequentialItem({ number: '1.', text: 'Call to Order' })).toBe(false)
    expect(isConsequentialItem({ number: '2.', text: 'Roll Call' })).toBe(false)
    expect(isConsequentialItem({ number: '6.', text: 'Consent Agenda A' })).toBe(false)
  })
})
