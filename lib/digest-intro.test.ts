import { describe, expect, it } from 'vitest'
import { buildDigestIntro, buildDigestIntroLLM, formatIntroDate, formatAlsoInside } from './digest-intro'
import type { DigestContent } from './digest'

const base: DigestContent = {
  needToKnow: [
    { slug: 'lead', sectionTitle: 'HSI Raids Omar’s Home', paragraphs: ['Homeland Security Investigations raided Rep. Ilhan Omar’s home Monday as part of a federal effort to strip her citizenship, per the Wall Street Journal.'] },
    { slug: 'ntk2', sectionTitle: 'Michigan Senate debate goes down to the wire', paragraphs: ['x'] },
    { slug: 'ntk3', sectionTitle: 'Four killed in Oregon school shooting', paragraphs: ['y'] },
  ],
  inTheKnow: {
    'Politics & World Affairs': [{ text: 'A chemical leak in Toledo, Ohio forced evacuations within a two-and-a-half-mile radius, according to NBC News.', slug: 'tol' }],
    'Science & Technology': [{ text: 'Researchers identified a vulnerability affecting up to 70% of websites globally.', slug: 'php' }],
    'Business & Markets': [],
    'Sports, Entertainment, & Culture': [{ text: '“Glee” will return with a reboot on Hulu and Disney+.', slug: 'glee' }],
    'Comedy & Satire': [],
  },
  etcetera: [],
  globalBlindspots: [{ region: 'South Asia', title: 'Bangladesh remittances hit a record $35.6 billion', slug: 'bd', summary: 's' }],
  globalLens: [{ region: 'Middle East', slug: 'iraq', title: 'Iraq releases families from detention camps', summary: 's' }],
}

describe('formatIntroDate', () => {
  it('formats a YYYY-MM-DD as "Weekday, Mon. D"', () => {
    expect(formatIntroDate('2026-10-22')).toBe('Thursday, Oct. 22')
    expect(formatIntroDate('2026-10-23')).toBe('Friday, Oct. 23')
  })
})

describe('buildDigestIntro', () => {
  it('greets with the date and draws the throughline from the lead', () => {
    const intro = buildDigestIntro(base, '2026-10-22')!
    expect(intro.greeting).toBe("Good morning. It's Thursday, Oct. 22.")
    expect(intro.throughline).toMatch(/^Homeland Security Investigations raided/)
    expect(intro.throughline.split(/\s+/).length).toBeLessThanOrEqual(28)
  })

  it('previews up to 4 items spread across distinct sections', () => {
    const intro = buildDigestIntro(base, '2026-10-22')!
    expect(intro.alsoInside.length).toBe(4)
    const sections = intro.alsoInside.map(a => a.section)
    expect(new Set(sections).size).toBe(4) // all distinct
    expect(sections).toContain('Need To Know')
    // teasers are short noun phrases with attribution trimmed
    const toledo = intro.alsoInside.find(a => /Toledo/.test(a.teaser))
    if (toledo) expect(toledo.teaser).not.toMatch(/according to/i)
  })

  it('returns null when there is no lead', () => {
    expect(buildDigestIntro({ ...base, needToKnow: [] }, '2026-10-22')).toBeNull()
  })
})

describe('formatAlsoInside', () => {
  it('joins teasers with their sections and a tail', () => {
    const line = formatAlsoInside([
      { teaser: 'a 70% website vulnerability', section: 'Science' },
      { teaser: '“Glee” gets a reboot', section: 'Culture' },
    ])
    expect(line).toBe('Also inside: a 70% website vulnerability (Science), “Glee” gets a reboot (Culture), and much more.')
  })
  it('is null when empty', () => {
    expect(formatAlsoInside([])).toBeNull()
  })
})

describe('buildDigestIntroLLM', () => {
  it('uses the model’s crafted throughline + teasers when the JSON is valid', async () => {
    const generate = async () => JSON.stringify({
      throughline: 'U.S. Patriot missile production is accelerating to replenish depleted stockpiles.',
      alsoInside: [
        { teaser: '10-year Treasury yield tops 5%', section: 'Business' },
        { teaser: 'Record Bangladesh remittances', section: 'Global Blindspot' },
        { teaser: 'A 70% website vulnerability', section: 'Science' },
      ],
    })
    const intro = (await buildDigestIntroLLM(base, '2026-10-23', generate))!
    expect(intro.greeting).toBe("Good morning. It's Friday, Oct. 23.")
    expect(intro.throughline).toMatch(/Patriot missile production/)
    expect(intro.alsoInside.map(a => a.teaser)).toContain('A 70% website vulnerability')
  })

  it('drops teasers with an unknown section or too many words', async () => {
    const generate = async () => JSON.stringify({
      throughline: 'Something happened today.',
      alsoInside: [
        { teaser: 'Valid short teaser', section: 'Business' },
        { teaser: 'this teaser has far too many words to be a crisp micro headline', section: 'Science' },
        { teaser: 'Bad section', section: 'Nonsense' },
        { teaser: 'Another good one', section: 'Culture' },
      ],
    })
    const intro = (await buildDigestIntroLLM(base, '2026-10-23', generate))!
    const sections = intro.alsoInside.map(a => a.section)
    expect(sections).toContain('Business')
    expect(sections).toContain('Culture')
    expect(sections).not.toContain('Science') // too many words
    expect(sections).not.toContain('Nonsense') // unknown section
  })

  it('falls back to the deterministic intro on malformed output', async () => {
    const generate = async () => 'not json at all'
    const llm = (await buildDigestIntroLLM(base, '2026-10-22', generate))!
    const deterministic = buildDigestIntro(base, '2026-10-22')!
    expect(llm.throughline).toBe(deterministic.throughline)
    expect(llm.alsoInside).toEqual(deterministic.alsoInside)
  })
})
