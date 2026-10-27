import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError, encodeParams, rawRequest } from '../client'

afterEach(() => vi.unstubAllGlobals())

describe('encodeParams', () => {
  it('encodes scalars and arrays PHP style', () => {
    const body = encodeParams({ a: 'x', n: 1, b: true, arr: ['1', '2'], u: undefined, z: null })
    expect(body.toString()).toBe('a=x&n=1&b=true&arr%5B%5D=1&arr%5B%5D=2')
  })
})

describe('ApiClient.post', () => {
  it('posts form data with the CSRF token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"OK"}'))
    vi.stubGlobal('fetch', fetchMock)
    const client = new ApiClient('ifm.php')
    client.csrfToken = 'tok'
    await expect(client.post('rename', { filename: 'a' })).resolves.toEqual({ status: 'OK' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('ifm.php')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'X-IFM-CSRF': 'tok' })
    expect((init.body as URLSearchParams).toString()).toBe('api=rename&filename=a')
  })

  it('omits the CSRF header without token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await new ApiClient('x').post('getFiles')
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({})
  })

  it('rejects on network errors, HTTP errors and invalid JSON', async () => {
    const client = new ApiClient('x')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(client.post('a')).rejects.toThrow(new ApiError('offline'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('weird'))
    await expect(client.post('a')).rejects.toThrow('weird')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(client.post('a')).rejects.toMatchObject({ status: 500 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>')))
    await expect(client.post('a')).rejects.toThrow('Invalid JSON response')
  })
})

/** Minimal XMLHttpRequest fake supporting what ApiClient.upload uses. */
class FakeXhr {
  static last: FakeXhr
  upload: { onprogress?: (e: Partial<ProgressEvent>) => void } = {}
  onload?: () => void
  onerror?: () => void
  status = 200
  responseText = ''
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: FormData | null = null
  constructor() {
    FakeXhr.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v
  }
  send(body: FormData) {
    this.body = body
  }
}

describe('ApiClient.upload', () => {
  it('uploads multipart data and reports progress', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const client = new ApiClient('ifm.php')
    client.csrfToken = 'tok'
    const progress = vi.fn()
    const promise = client.upload({ dir: 'd', file: new Blob(['x']) }, progress)
    const xhr = FakeXhr.last
    expect(xhr.method).toBe('POST')
    expect(xhr.headers).toEqual({ 'X-IFM-CSRF': 'tok' })
    expect(xhr.body?.get('api')).toBe('upload')
    expect(xhr.body?.get('dir')).toBe('d')
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 5, total: 0 })
    expect(progress).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenCalledWith(50)
    xhr.responseText = '{"status":"OK","cd":"d"}'
    xhr.onload?.()
    await expect(promise).resolves.toEqual({ status: 'OK', cd: 'd' })
  })

  it('rejects on errors', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const client = new ApiClient('ifm.php')

    let p = client.upload({})
    FakeXhr.last.status = 413
    FakeXhr.last.onload?.()
    await expect(p).rejects.toMatchObject({ status: 413 })

    p = client.upload({})
    FakeXhr.last.responseText = 'nope'
    FakeXhr.last.onload?.()
    await expect(p).rejects.toThrow('Invalid JSON response')

    p = client.upload({})
    FakeXhr.last.onerror?.()
    await expect(p).rejects.toThrow('Network error')
  })
})

describe('rawRequest', () => {
  it('sends same-origin POST requests with the CSRF token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('hello', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await rawRequest('/ifm.php', 'POST', 'a=1&b=2', 'tok')
    expect(res).toEqual({ status: 201, body: 'hello', ok: true })
    const init = fetchMock.mock.calls[0]![1]
    expect(init.body).toBe('a=1&b=2')
    expect(init.cache).toBe('no-store')
    expect(init.headers['X-IFM-CSRF']).toBe('tok')
  })

  it('never sends the CSRF token to other origins', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x'))
    vi.stubGlobal('fetch', fetchMock)
    await rawRequest('https://evil.example/', 'POST', '', 'tok')
    expect(fetchMock.mock.calls[0]![1].headers['X-IFM-CSRF']).toBeUndefined()
  })

  it('sends GET requests without body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('nf', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await rawRequest('/x', 'GET', 'ignored', 'tok')
    expect(res).toEqual({ status: 404, body: 'nf', ok: false })
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined()
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({})
  })

  it('reports network errors as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(rawRequest('http://[invalid', 'POST', '', null)).resolves.toEqual({
      status: 0,
      body: 'Failed to fetch',
      ok: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('x'))
    await expect(rawRequest('/x', 'GET', '', null)).resolves.toMatchObject({ body: '' })
  })
})
