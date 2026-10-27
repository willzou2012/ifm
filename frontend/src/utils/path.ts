/**
 * Combines path components with exactly one slash between them. Empty and
 * non-string components are ignored; a trailing slash of the first component
 * and leading/trailing slashes of all other components are removed.
 */
export function pathCombine(...parts: unknown[]): string {
  const args = parts.filter((x): x is string => typeof x === 'string' && x !== '')
  if (args.length === 0) return ''

  const first = args.shift()!.replace(/\/+$/g, '')
  if (args.length === 0) return first

  return [first, ...args.map((v) => v.replace(/^\/*|\/*$/g, ''))].join('/')
}

const HREF_ESCAPES: Record<string, string> = {
  '%': '%25',
  ';': '%3B',
  '?': '%3F',
  ':': '%3A',
  '@': '%40',
  '&': '%26',
  '=': '%3D',
  '+': '%2B',
  $: '%24',
  ',': '%2C',
  '<': '%3C',
  '>': '%3E',
  '#': '%23',
  '"': '%22',
  '{': '%7B',
  '}': '%7D',
  '|': '%7C',
  '^': '%5E',
  '[': '%5B',
  ']': '%5D',
  '\\': '%5C',
  '`': '%60',
}

/**
 * Encodes a string for use in the href attribute of an anchor. Slashes and
 * spaces are kept, so the result can still be used as a relative path.
 */
export function hrefEncode(s: string): string {
  return s.replace(/[%;?:@&=+$,<>#"{}|^[\]\\`]/g, (c) => HREF_ESCAPES[c]!)
}

/** Returns everything after the last slash (the file name of a path). */
export function basename(path: string): string {
  return path.substring(path.lastIndexOf('/') + 1)
}

/** Returns everything before the last slash, or `fallback` if there is none. */
export function dirname(path: string, fallback = '/'): string {
  const idx = path.lastIndexOf('/')
  return idx > 0 ? path.substring(0, idx) : fallback
}

/**
 * Appends query parameters to a URL which may already contain a query string.
 */
export function appendQuery(url: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return url + (url.includes('?') ? '&' : '?') + query
}
