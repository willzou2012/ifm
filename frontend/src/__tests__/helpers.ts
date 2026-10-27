import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import en from '../../../src/i18n/en.json'
import { useIfmStore } from '@/stores/ifm'
import type { IfmConfig, RawFileItem } from '@/types'
import { decorateItem } from '@/utils/files'

export const i18n: Record<string, string> = en

export const defaultConfig: IfmConfig = {
  auth: 0,
  ajaxrequest: 1,
  chmod: 1,
  copymove: 1,
  createdir: 1,
  createfile: 1,
  edit: 1,
  delete: 1,
  download: 1,
  extract: 1,
  upload: 1,
  remoteupload: 1,
  rename: 1,
  zipnload: 1,
  createarchive: 1,
  search: 1,
  paging: 0,
  pageLength: 50,
  showlastmodified: 1,
  showfilesize: 1,
  showowner: 1,
  showgroup: 1,
  showpermissions: 2,
  showrefresh: 1,
  contextmenu: 1,
  confirmoverwrite: 1,
  customDateFormat: false,
  root_public_url: '',
  inline: false,
  isDocroot: true,
  csrf_token: 'token123',
  ace_includes: '',
}

export function rawFile(name: string, extra: Partial<RawFileItem> = {}): RawFileItem {
  return {
    name,
    type: 'file',
    icon: 'icon fa fa-file-text-o',
    ext: name.includes('.') ? name.split('.').pop() : '',
    mime_type: 'text/plain',
    lastmodified: 1700000000,
    size: '1 KB',
    size_raw: 1024,
    fileperms: 'rw- r-- r--',
    filepermmode: 'long',
    owner: 'alice',
    group: 'staff',
    ...extra,
  }
}

export function rawDir(name: string, extra: Partial<RawFileItem> = {}): RawFileItem {
  return rawFile(name, {
    type: 'dir',
    icon: name === '..' ? 'icon fa fa-angle-up' : 'icon fa fa-folder-o',
    ext: undefined,
    mime_type: undefined,
    size: '',
    size_raw: 0,
    ...extra,
  })
}

export type Handler = (params: URLSearchParams) => unknown

/**
 * Replaces `fetch` with a fake IFM backend. Handlers are looked up by the
 * `api` parameter; returning an `Error` makes the request fail.
 */
export function mockBackend(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body as URLSearchParams
    const api = body.get('api') ?? ''
    const handler = handlers[api]
    if (!handler) throw new Error(`unhandled api ${api}`)
    const result = await handler(body)
    if (result instanceof Error) throw result
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Creates an active pinia with a ready store using the given config and files. */
export function setupStore(
  options: { config?: Partial<IfmConfig>; files?: RawFileItem[]; currentDir?: string } = {},
) {
  setActivePinia(createPinia())
  const store = useIfmStore()
  store.setApiUrl('http://localhost/ifm.php')
  store.config = { ...defaultConfig, ...options.config }
  store.i18n = i18n
  store.status = 'ready'
  store.currentDir = options.currentDir ?? ''
  const ctx = store.decorateContext()
  store.files = (options.files ?? []).map((f) => decorateItem(f, ctx))
  return store
}

/** Waits for pending promises and Vue updates. */
export async function flushPromises() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}
