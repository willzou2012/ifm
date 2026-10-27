import type { FileItem, IfmConfig, RawFileItem, SearchResult } from '@/types'
import { generateGuid } from './guid'
import { formatDate } from './format'
import { appendQuery, basename, dirname, hrefEncode, pathCombine } from './path'

export const EXTRACTABLE_EXTENSIONS = ['zip', 'tar', 'tgz', 'tar.gz', 'tar.xz', 'tar.bz2']
export const ARCHIVE_FORMATS = ['.tar.bz2', '.tar.gz', '.zip', '.tar']

/** Location information needed to compute links; defaults to `window.location`. */
export interface LocationLike {
  origin: string
  pathname: string
}

export interface DecorateContext {
  config: IfmConfig
  api: string
  currentDir: string
  isMobile: boolean
}

/** Whether a file can be opened in the editor, based on its MIME type. */
export function isEditable(item: RawFileItem, config: IfmConfig): boolean {
  if (config.disable_mime_detection) return true
  const mime = item.mime_type
  if (typeof mime !== 'string') return false
  return (
    mime.substring(0, 4) === 'text' ||
    mime.includes('x-empty') ||
    mime.includes('xml') ||
    mime.includes('json')
  )
}

/** Builds the URL of a download-like API endpoint (download, zipnload, proxy). */
export function apiFileUrl(api: string, action: string, dir: string, filename: string): string {
  return appendQuery(api, { api: action, dir, filename })
}

/**
 * Enriches a raw item of the `getFiles` API with links, buttons and display
 * values, according to the active configuration.
 */
export function decorateItem(raw: RawFileItem, ctx: DecorateContext): FileItem {
  const { config, api, currentDir } = ctx
  const isParent = raw.name === '..'
  const item: FileItem = {
    ...raw,
    guid: generateGuid(),
    linkname: isParent ? '[ up ]' : raw.name,
    isParent,
    lastmodified_hr: formatDate(raw.lastmodified, config.customDateFormat),
    link: '#',
    download: { name: isParent ? '.' : raw.name, link: '' },
    buttons: [],
    draggable: !isParent && raw.name !== '.',
    imagePreview: false,
  }

  if (raw.type === 'dir') {
    if (config.download && config.zipnload) {
      item.download.action = 'zipnload'
      item.download.icon = 'icon fa fa-fw fa-cloud-download'
    }
  } else {
    if (config.download) {
      item.download.action = 'download'
      item.download.icon = 'icon fa fa-fw fa-download'
    }
    item.imagePreview = raw.icon.includes('file-image') && !ctx.isMobile
    if (config.extract && EXTRACTABLE_EXTENSIONS.includes(raw.ext ?? '')) {
      item.eaction = 'extract'
      item.buttons.push({
        action: 'extract',
        icon: 'icon fa fa-fw fa-file-archive-o',
        title: 'extract',
      })
    } else if (config.edit && isEditable(raw, config)) {
      item.eaction = 'edit'
      item.buttons.push({ action: 'edit', icon: 'icon fa fa-fw fa-pencil', title: 'edit' })
    }
  }

  if (item.download.action)
    item.download.link = apiFileUrl(api, item.download.action, currentDir, item.download.name)

  if (config.isDocroot && !config.forceproxy) {
    item.link = hrefEncode(pathCombine(currentDir, raw.name))
  } else if (config.download && config.zipnload) {
    const publicUrl = config.root_public_url
    if (publicUrl) {
      const encodedDir = hrefEncode(currentDir)
      const encodedName = hrefEncode(raw.name)
      item.link =
        publicUrl.charAt(0) === '/'
          ? pathCombine(window.location.origin, publicUrl, encodedDir, encodedName)
          : pathCombine(publicUrl, encodedDir, encodedName)
    } else {
      const action = item.download.action === 'zipnload' ? 'zipnload' : 'proxy'
      item.link = apiFileUrl(api, action, currentDir, item.download.name)
    }
  }

  if (item.draggable) {
    if (config.copymove)
      item.buttons.push({
        action: 'copymove',
        icon: 'icon fa fa-fw fa-files-o',
        title: 'copy/move',
      })
    if (config.rename)
      item.buttons.push({ action: 'rename', icon: 'icon fa fa-fw fa-terminal', title: 'rename' })
    if (config.delete)
      item.buttons.push({ action: 'delete', icon: 'icon fa fa-fw fa-trash', title: 'delete' })
  }

  return item
}

/** URL of the preview image shown when hovering an image file. */
export function imagePreviewUrl(item: FileItem, ctx: DecorateContext): string {
  if (ctx.config.isDocroot)
    return encodeURI(pathCombine(ctx.currentDir, item.name))
      .replace(/#/g, '%23')
      .replace(/\?/g, '%3F')
  return appendQuery(ctx.api, { api: 'proxy', dir: ctx.currentDir, filename: item.name })
}

/**
 * Computes the absolute link which is copied by the "copy link" context menu
 * entry. Relative links are resolved against the directory of the IFM script.
 */
export function absoluteLink(link: string, location: LocationLike = window.location): string {
  if (link.toLowerCase().substring(0, 4) === 'http') return link
  const pathname = location.pathname.replace(/^\/*/g, '').split('/')
  pathname.pop()
  if (pathname.length > 0) return pathCombine(location.origin, pathname.join('/'), link)
  return pathCombine(location.origin, link)
}

/** Converts a raw search result into an entry of the search results list. */
export function decorateSearchResult(raw: RawFileItem): SearchResult {
  return {
    ...raw,
    guid: generateGuid(),
    folder: dirname(raw.name),
    linkname: basename(raw.name),
  }
}

/** Suggested target directory when extracting an archive: its name without extension. */
export function extractTargetSuggestion(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx > 1 ? filename.substring(0, idx) : filename
}

/** Returns the archive format (zip, tar, tar.gz, tar.bz2) of a file name, if valid. */
export function archiveFormat(archivename: string): string | undefined {
  const ext = ARCHIVE_FORMATS.find((e) => archivename.toLowerCase().endsWith(e))
  return ext?.slice(1)
}

/** Derives a file name from a URL (last path segment without query and hash). */
export function filenameFromUrl(url: string): string {
  return url.split('/').pop()!.split('?')[0]!.split('#')[0]!
}

/**
 * Returns `name` or, if it is already taken, the first free variant of the
 * form `name (1).ext`, `name (2).ext`, ...
 */
export function uniqueFilename(name: string, existing: readonly string[]): string {
  const dotIdx = name.lastIndexOf('.')
  let finalName = name
  for (let counter = 1; existing.includes(finalName); counter++) {
    finalName =
      dotIdx > 0
        ? `${name.substring(0, dotIdx)} (${counter})${name.substring(dotIdx)}`
        : `${name} (${counter})`
  }
  return finalName
}

/** Identity of a selected upload file, used to avoid adding it twice. */
export function fileFingerprint(f: File): string {
  return `${f.name}\0${f.size}\0${f.lastModified}`
}
