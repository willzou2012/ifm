import { afterEach, describe, expect, it, vi } from 'vitest'
import { customStrftime, formatDate } from '../format'

describe('customStrftime', () => {
  const date = new Date(2024, 0, 5, 7, 8, 9)

  it('replaces numeric conversion specifiers', () => {
    expect(customStrftime(date, '%Y-%m-%d %H:%M:%S (%y)')).toBe('2024-01-05 07:08:09 (24)')
  })

  it('replaces textual conversion specifiers', () => {
    const result = customStrftime(date, '%b|%B|%a|%A')
    expect(result.split('|')).toEqual([
      date.toLocaleString('default', { month: 'short' }),
      date.toLocaleString('default', { month: 'long' }),
      date.toLocaleString('default', { weekday: 'short' }),
      date.toLocaleString('default', { weekday: 'long' }),
    ])
  })

  it('keeps unknown specifiers', () => {
    expect(customStrftime(date, '%Q %Y')).toBe('%Q 2024')
  })
})

describe('formatDate', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns an empty string without timestamp', () => {
    expect(formatDate(undefined)).toBe('')
  })

  it('uses the custom format', () => {
    const ts = new Date(2024, 1, 3, 4, 5, 6).getTime() / 1000
    expect(formatDate(ts, '%d.%m.%Y')).toBe('03.02.2024')
  })

  it('falls back to the browser locale', () => {
    const ts = 1700000000
    expect(formatDate(ts)).toBe(new Date(ts * 1000).toLocaleString(navigator.language))
  })

  it('uses en-US if the browser has no language', () => {
    vi.stubGlobal('navigator', { language: '' })
    const ts = 1700000000
    expect(formatDate(ts)).toBe(new Date(ts * 1000).toLocaleString('en-US'))
  })
})
