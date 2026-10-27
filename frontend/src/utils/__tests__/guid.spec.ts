import { describe, expect, it } from 'vitest'
import { generateGuid } from '../guid'

describe('generateGuid', () => {
  it('generates 20 uppercase hex characters', () => {
    expect(generateGuid()).toMatch(/^[0-9A-F]{20}$/)
    expect(generateGuid()).not.toBe(generateGuid())
  })
})
