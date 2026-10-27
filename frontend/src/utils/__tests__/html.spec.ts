import { describe, expect, it } from 'vitest'
import { decodeEntities, sanitizeHtml } from '../html'

describe('sanitizeHtml', () => {
  it('keeps simple formatting tags', () => {
    expect(sanitizeHtml('Could not copy:<ul><li>a.txt</li><li>b</li></ul>')).toBe(
      'Could not copy:<ul><li>a.txt</li><li>b</li></ul>',
    )
  })

  it('drops attributes and dangerous elements', () => {
    expect(sanitizeHtml('<b onclick="x()">bold</b><img src=x onerror=alert(1)>')).toBe(
      '<b>bold</b>',
    )
    expect(sanitizeHtml('<script>alert(1)</script>ok')).toBe('alert(1)ok')
    expect(sanitizeHtml('<a href="javascript:x">link</a>')).toBe('link')
  })

  it('keeps entities escaped', () => {
    expect(sanitizeHtml('a &lt;b&gt; &amp; c')).toBe('a &lt;b&gt; &amp; c')
  })

  it('handles comments', () => {
    expect(sanitizeHtml('a<!-- c -->b')).toBe('a c b')
  })
})

describe('decodeEntities', () => {
  it('decodes HTML entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &quot;x&quot;')).toBe('Tom & Jerry <3 "x"')
  })
})
