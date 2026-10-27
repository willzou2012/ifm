import type { ApiStatus } from '@/types'

export type ParamValue = string | number | boolean | null | undefined | readonly string[]
export type Params = Record<string, ParamValue>

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Serializes parameters the way PHP expects them: arrays become `key[]=a&key[]=b`.
 */
export function encodeParams(params: Params): URLSearchParams {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) value.forEach((v) => body.append(`${key}[]`, v))
    else body.append(key, String(value))
  }
  return body
}

/**
 * Thin client for the IFM JSON API. Every request is a POST to the API URL,
 * carrying the CSRF token in the `X-IFM-CSRF` header once it is known.
 */
export class ApiClient {
  csrfToken: string | null = null

  constructor(readonly url: string) {}

  private headers(): Record<string, string> {
    return this.csrfToken ? { 'X-IFM-CSRF': this.csrfToken } : {}
  }

  async post<T = ApiStatus>(api: string, params: Params = {}): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: this.headers(),
        body: encodeParams({ api, ...params }),
      })
    } catch (e) {
      throw new ApiError(e instanceof Error ? e.message : String(e))
    }
    if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status)
    try {
      return (await response.json()) as T
    } catch {
      throw new ApiError('Invalid JSON response', response.status)
    }
  }

  /**
   * Uploads a file via multipart/form-data. XMLHttpRequest is used instead of
   * fetch because only it reports upload progress.
   */
  upload<T = ApiStatus>(
    fields: Record<string, string | Blob>,
    onProgress?: (percent: number) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const data = new FormData()
      data.append('api', 'upload')
      for (const [key, value] of Object.entries(fields)) data.append(key, value)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', this.url)
      for (const [key, value] of Object.entries(this.headers())) xhr.setRequestHeader(key, value)
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) onProgress((evt.loaded / evt.total) * 100)
      }
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new ApiError(`HTTP ${xhr.status}`, xhr.status))
          return
        }
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiError('Invalid JSON response', xhr.status))
        }
      }
      xhr.onerror = () => reject(new ApiError('Network error'))
      xhr.send(data)
    })
  }
}

export interface RawResponse {
  status: number
  body: string
  ok: boolean
}

/**
 * Performs an arbitrary HTTP request for the "AJAX request" tool. The CSRF
 * token is only attached to same-origin POST requests, so it never leaks to
 * third parties.
 */
export async function rawRequest(
  url: string,
  method: 'GET' | 'POST',
  data: string,
  csrfToken: string | null,
): Promise<RawResponse> {
  const headers: Record<string, string> = {}
  let sameOrigin = false
  try {
    sameOrigin = new URL(url, window.location.href).origin === window.location.origin
  } catch {
    // invalid URL, fetch will reject it below
  }
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    if (sameOrigin && csrfToken) headers['X-IFM-CSRF'] = csrfToken
  }
  try {
    const response = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      body: method === 'POST' ? data : undefined,
    })
    return { status: response.status, body: await response.text(), ok: response.ok }
  } catch (e) {
    return { status: 0, body: e instanceof Error ? e.message : '', ok: false }
  }
}
