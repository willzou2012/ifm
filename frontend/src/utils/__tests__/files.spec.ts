import { describe, expect, it } from 'vitest'
import { defaultConfig, rawDir, rawFile } from '@/__tests__/helpers'
import type { IfmConfig } from '@/types'
import {
  absoluteLink,
  archiveFormat,
  decorateItem,
  decorateSearchResult,
  extractTargetSuggestion,
  fileFingerprint,
  filenameFromUrl,
  imagePreviewUrl,
  isEditable,
  uniqueFilename,
  type DecorateContext,
} from '../files'

const API = 'http://host/ifm.php'

function ctx(config: Partial<IfmConfig> = {}, currentDir = 'sub dir'): DecorateContext {
  return { config: { ...defaultConfig, ...config }, api: API, currentDir, isMobile: false }
}

describe('isEditable', () => {
  it('detects text like MIME types', () => {
    const c = defaultConfig
    expect(isEditable(rawFile('a', { mime_type: 'text/plain' }), c)).toBe(true)
    expect(isEditable(rawFile('a', { mime_type: 'inode/x-empty' }), c)).toBe(true)
    expect(isEditable(rawFile('a', { mime_type: 'application/xml' }), c)).toBe(true)
    expect(isEditable(rawFile('a', { mime_type: 'application/json' }), c)).toBe(true)
    expect(isEditable(rawFile('a', { mime_type: 'image/png' }), c)).toBe(false)
    expect(isEditable(rawFile('a', { mime_type: false }), c)).toBe(false)
  })

  it('treats everything as editable without MIME detection', () => {
    const c = { ...defaultConfig, disable_mime_detection: 1 }
    expect(isEditable(rawFile('a', { mime_type: undefined }), c)).toBe(true)
  })
})

describe('decorateItem', () => {
  it('decorates a text file in the document root', () => {
    const item = decorateItem(rawFile('a&b.txt'), ctx())
    expect(item.guid).toMatch(/^[0-9A-F]{20}$/)
    expect(item.linkname).toBe('a&b.txt')
    expect(item.isParent).toBe(false)
    expect(item.draggable).toBe(true)
    expect(item.eaction).toBe('edit')
    expect(item.buttons.map((b) => b.action)).toEqual(['edit', 'copymove', 'rename', 'delete'])
    expect(item.download).toMatchObject({
      name: 'a&b.txt',
      action: 'download',
      icon: 'icon fa fa-fw fa-download',
      link: `${API}?api=download&dir=sub%20dir&filename=a%26b.txt`,
    })
    expect(item.link).toBe('sub dir/a%26b.txt')
    expect(item.lastmodified_hr).not.toBe('')
  })

  it('decorates the parent directory', () => {
    const item = decorateItem(rawDir('..'), ctx())
    expect(item.isParent).toBe(true)
    expect(item.linkname).toBe('[ up ]')
    expect(item.draggable).toBe(false)
    expect(item.buttons).toEqual([])
    expect(item.download).toMatchObject({ name: '.', action: 'zipnload' })
  })

  it('offers extraction for archives', () => {
    for (const name of ['a.zip', 'a.tar', 'a.tgz', 'a.tar.gz', 'a.tar.xz', 'a.tar.bz2']) {
      const ext = name.substring(2)
      const item = decorateItem(rawFile(name, { ext, mime_type: 'application/zip' }), ctx())
      expect(item.eaction).toBe('extract')
      expect(item.buttons[0]?.action).toBe('extract')
    }
  })

  it('respects disabled features', () => {
    const config = {
      download: 0,
      edit: 0,
      extract: 0,
      copymove: 0,
      rename: 0,
      delete: 0,
    }
    const file = decorateItem(rawFile('a.zip', { ext: 'zip' }), ctx(config))
    expect(file.buttons).toEqual([])
    expect(file.eaction).toBeUndefined()
    expect(file.download.action).toBeUndefined()
    expect(file.download.link).toBe('')
    const dir = decorateItem(rawDir('d'), ctx({ zipnload: 0 }))
    expect(dir.download.action).toBeUndefined()
  })

  it('enables the image preview on desktop only', () => {
    const img = rawFile('a.png', { icon: 'icon fa fa-file-image-o', mime_type: 'image/png' })
    expect(decorateItem(img, ctx()).imagePreview).toBe(true)
    expect(decorateItem(img, { ...ctx(), isMobile: true }).imagePreview).toBe(false)
    expect(decorateItem(rawDir('d'), ctx()).imagePreview).toBe(false)
  })

  it('links through the proxy outside the document root', () => {
    const c = ctx({ isDocroot: false })
    expect(decorateItem(rawFile('a.txt'), c).link).toBe(
      `${API}?api=proxy&dir=sub%20dir&filename=a.txt`,
    )
    expect(decorateItem(rawDir('d'), c).link).toBe(`${API}?api=zipnload&dir=sub%20dir&filename=d`)
    expect(decorateItem(rawFile('a.txt'), ctx({ isDocroot: true, forceproxy: 1 })).link).toContain(
      'api=proxy',
    )
  })

  it('uses the public root URL', () => {
    const absolute = ctx({ isDocroot: false, root_public_url: '/www' })
    expect(decorateItem(rawFile('a#.txt'), absolute).link).toBe(
      `${window.location.origin}/www/sub dir/a%23.txt`,
    )
    const external = ctx({ isDocroot: false, root_public_url: 'https://cdn.example/files/' })
    expect(decorateItem(rawFile('a.txt'), external).link).toBe(
      'https://cdn.example/files/sub dir/a.txt',
    )
  })

  it('has no link without download permission outside the document root', () => {
    expect(decorateItem(rawFile('a.txt'), ctx({ isDocroot: false, download: 0 })).link).toBe('#')
  })
})

describe('imagePreviewUrl', () => {
  it('links the file directly in the document root', () => {
    const item = decorateItem(rawFile('a #?.png'), ctx())
    expect(imagePreviewUrl(item, ctx())).toBe('sub%20dir/a%20%23%3F.png')
  })

  it('uses the proxy otherwise', () => {
    const c = ctx({ isDocroot: false })
    const item = decorateItem(rawFile('a.png'), c)
    expect(imagePreviewUrl(item, c)).toBe(`${API}?api=proxy&dir=sub%20dir&filename=a.png`)
  })
})

describe('absoluteLink', () => {
  it('keeps absolute links', () => {
    expect(absoluteLink('https://x/y')).toBe('https://x/y')
    expect(absoluteLink('HTTP://x/y')).toBe('HTTP://x/y')
  })

  it('resolves relative links against the script directory', () => {
    expect(absoluteLink('dir/file', { origin: 'https://h', pathname: '/tools/ifm.php' })).toBe(
      'https://h/tools/dir/file',
    )
    expect(absoluteLink('file', { origin: 'https://h', pathname: '/ifm.php' })).toBe(
      'https://h/file',
    )
  })

  it('defaults to the window location', () => {
    expect(absoluteLink('x')).toContain(window.location.origin)
  })
})

describe('small helpers', () => {
  it('decorates search results', () => {
    const result = decorateSearchResult(rawFile('./docs/deep/needle.txt'))
    expect(result.folder).toBe('./docs/deep')
    expect(result.linkname).toBe('needle.txt')
    expect(decorateSearchResult(rawFile('top.txt')).folder).toBe('/')
  })

  it('suggests extraction targets', () => {
    expect(extractTargetSuggestion('archive.zip')).toBe('archive')
    expect(extractTargetSuggestion('a.tar.gz')).toBe('a.tar')
    expect(extractTargetSuggestion('.z')).toBe('.z')
    expect(extractTargetSuggestion('noext')).toBe('noext')
  })

  it('detects archive formats', () => {
    expect(archiveFormat('x.ZIP')).toBe('zip')
    expect(archiveFormat('x.tar')).toBe('tar')
    expect(archiveFormat('x.tar.gz')).toBe('tar.gz')
    expect(archiveFormat('x.tar.bz2')).toBe('tar.bz2')
    expect(archiveFormat('x.rar')).toBeUndefined()
  })

  it('derives file names from URLs', () => {
    expect(filenameFromUrl('https://h/a/b.tar.gz?x=1#y')).toBe('b.tar.gz')
    expect(filenameFromUrl('https://h/')).toBe('')
  })

  it('finds unique file names', () => {
    expect(uniqueFilename('a.txt', [])).toBe('a.txt')
    expect(uniqueFilename('a.txt', ['a.txt', 'a (1).txt'])).toBe('a (2).txt')
    expect(uniqueFilename('README', ['README'])).toBe('README (1)')
    expect(uniqueFilename('.env', ['.env'])).toBe('.env (1)')
  })

  it('fingerprints files', () => {
    const f = new File(['abc'], 'a.txt', { lastModified: 5 })
    expect(fileFingerprint(f)).toBe('a.txt\u00003\u00005')
  })
})
