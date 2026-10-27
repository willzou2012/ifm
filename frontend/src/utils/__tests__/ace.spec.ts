import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAce, modeForPath, type AceStatic } from '../ace'

describe('ace helpers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the global ace object', () => {
    expect(getAce()).toBeUndefined()
    const ace = { edit: vi.fn(), require: vi.fn() }
    vi.stubGlobal('ace', ace)
    expect(getAce()).toBe(ace)
  })

  it('determines the mode via the modelist extension', () => {
    const ace = {
      edit: vi.fn(),
      require: vi.fn(() => ({ getModeForPath: (p: string) => ({ mode: `ace/mode/${p}` }) })),
    } as unknown as AceStatic
    expect(modeForPath(ace, 'php')).toBe('ace/mode/php')
    expect(ace.require).toHaveBeenCalledWith('ace/ext/modelist')
  })

  it('returns undefined without the modelist extension', () => {
    const missing = { edit: vi.fn(), require: vi.fn(() => undefined) } as unknown as AceStatic
    expect(modeForPath(missing, 'a.php')).toBeUndefined()
    const throwing = {
      edit: vi.fn(),
      require: vi.fn(() => {
        throw new Error('not loaded')
      }),
    } as unknown as AceStatic
    expect(modeForPath(throwing, 'a.php')).toBeUndefined()
  })
})
