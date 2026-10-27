import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '../clipboard'

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    // @ts-expect-error cleanup of the stub below
    delete document.execCommand
  })

  it('uses the async clipboard API in secure contexts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('isSecureContext', true)
    await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand and restores the selection', async () => {
    vi.stubGlobal('isSecureContext', false)
    const p = document.createElement('p')
    p.textContent = 'selected text'
    document.body.appendChild(p)
    const range = document.createRange()
    range.selectNodeContents(p)
    document.getSelection()!.addRange(range)

    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')!.value
      return true
    })
    await copyToClipboard('fallback')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('fallback')
    expect(document.querySelector('textarea')).toBeNull()
    expect(document.getSelection()!.toString()).toBe('selected text')
  })

  it('falls back if the clipboard API rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })
    vi.stubGlobal('isSecureContext', true)
    document.getSelection()!.removeAllRanges()
    document.execCommand = vi.fn(() => true)
    await copyToClipboard('x')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })
})
