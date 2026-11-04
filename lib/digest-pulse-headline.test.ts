import { describe, expect, it } from 'vitest'
import { cleanPulseHeadline } from './digest'

describe('cleanPulseHeadline (Mainstream Pulse title cleaning)', () => {
  it('drops a section/brand landing title, both dash variants (the NYT-Sunday "The Athletic" bug)', () => {
    expect(cleanPulseHeadline('The Athletic - The New York Times')).toBeNull()
    expect(cleanPulseHeadline('The Athletic – The New York Times')).toBeNull() // en-dash
    expect(cleanPulseHeadline('Wordle - The New York Times')).toBeNull()
  })

  it('keeps a real article headline and strips the trailing source', () => {
    expect(cleanPulseHeadline('Democrats Show Strength in Final Days of Race for the Senate - The New York Times'))
      .toBe('Democrats Show Strength in Final Days of Race for the Senate')
  })

  it('keeps a real headline that merely contains a section word', () => {
    expect(cleanPulseHeadline('The Athletic reports Lakers trade talks heat up - The New York Times'))
      .toBe('The Athletic reports Lakers trade talks heat up')
  })

  it('drops opinion, too-short, and print/nav titles', () => {
    expect(cleanPulseHeadline('Opinion | A dangerous moment for the republic - The New York Times')).toBeNull()
    expect(cleanPulseHeadline('Live - The New York Times')).toBeNull()
    expect(cleanPulseHeadline('Today’s Paper | The New York Times print edition')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(cleanPulseHeadline('')).toBeNull()
  })
})
