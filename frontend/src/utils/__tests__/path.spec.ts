import { describe, expect, it } from 'vitest'
import { appendQuery, basename, dirname, hrefEncode, pathCombine } from '../path'

describe('pathCombine', () => {
  it('returns an empty string without usable components', () => {
    expect(pathCombine()).toBe('')
    expect(pathCombine('', undefined, null, 5)).toBe('')
  })

  it('returns a single component without trailing slashes', () => {
    expect(pathCombine('foo//')).toBe('foo')
  })

  it('joins components with exactly one slash', () => {
    expect(pathCombine('/a/', '/b/', 'c/')).toBe('/a/b/c')
    expect(pathCombine('http://host', 'dir', 'file.txt')).toBe('http://host/dir/file.txt')
  })

  it('skips empty and non-string components', () => {
    expect(pathCombine(undefined, '', 'dir', '', 'file')).toBe('dir/file')
  })
})

describe('hrefEncode', () => {
  it('encodes characters which have a special meaning in URLs', () => {
    expect(hrefEncode('a%b;c?d:e@f&g=h+i$j,k')).toBe('a%25b%3Bc%3Fd%3Ae%40f%26g%3Dh%2Bi%24j%2Ck')
    expect(hrefEncode('<>#"{}|^[]\\`')).toBe('%3C%3E%23%22%7B%7D%7C%5E%5B%5D%5C%60')
  })

  it('keeps slashes and spaces', () => {
    expect(hrefEncode('dir/my file.txt')).toBe('dir/my file.txt')
  })
})

describe('basename / dirname', () => {
  it('splits paths', () => {
    expect(basename('./a/b.txt')).toBe('b.txt')
    expect(basename('b.txt')).toBe('b.txt')
    expect(dirname('./a/b.txt')).toBe('./a')
    expect(dirname('b.txt')).toBe('/')
    expect(dirname('/b.txt')).toBe('/')
    expect(dirname('b.txt', '.')).toBe('.')
  })
})

describe('appendQuery', () => {
  it('adds a query string', () => {
    expect(appendQuery('ifm.php', { api: 'download', filename: 'a b&c' })).toBe(
      'ifm.php?api=download&filename=a%20b%26c',
    )
  })

  it('extends an existing query string', () => {
    expect(appendQuery('ifm.php?lang=de', { api: 'proxy' })).toBe('ifm.php?lang=de&api=proxy')
  })
})
