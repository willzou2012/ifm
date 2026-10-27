import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useIfmStore } from '../ifm'
import {
  defaultConfig,
  flushPromises,
  i18n,
  mockBackend,
  rawDir,
  rawFile,
  setupStore,
} from '@/__tests__/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

describe('initialization', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads config, texts and files', async () => {
    const fetchMock = mockBackend({
      getConfig: () => defaultConfig,
      getI18N: () => i18n,
      checkAuth: () => ({ status: 'OK' }),
      getFiles: () => [rawDir('docs'), rawFile('a.txt')],
    })
    const store = useIfmStore()
    await store.init()
    expect(store.status).toBe('ready')
    expect(store.api.csrfToken).toBe('token123')
    expect(store.t('upload')).toBe('Upload')
    expect(store.fileNames).toEqual(['docs', 'a.txt'])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    // the CSRF token is sent once known
    expect(fetchMock.mock.calls[3]![1]!.headers).toEqual({ 'X-IFM-CSRF': 'token123' })
  })

  it('shows the login if not authenticated', async () => {
    mockBackend({
      getConfig: () => ({ ...defaultConfig, csrf_token: undefined }),
      getI18N: () => i18n,
      checkAuth: () => ({ status: 'ERROR', message: 'Not authenticated' }),
    })
    const store = useIfmStore()
    await store.init()
    expect(store.status).toBe('login')
    expect(store.api.csrfToken).toBeNull()
  })

  it.each([
    ['getConfig', 'Could not load configuration.'],
    ['getI18N', 'Could not load texts.'],
    ['checkAuth', 'General error: No or broken response.'],
  ])('reports a failing %s request', async (failing, message) => {
    const handlers = {
      getConfig: () => defaultConfig,
      getI18N: () => ({}),
      checkAuth: () => ({ status: 'OK' }),
    } as Record<string, () => unknown>
    handlers[failing] = () => new Error('down')
    mockBackend(handlers)
    const store = useIfmStore()
    await store.init()
    expect(store.status).toBe('error')
    expect(store.initError).toBe(message)
  })

  it('opens the directory from the URL hash', async () => {
    history.replaceState(null, '', '/#docs%2Fdeep')
    const getFiles = vi.fn((_p: URLSearchParams) => [rawFile('needle.txt')])
    mockBackend({
      getRealpath: (p) => ({ realpath: p.get('dir') }),
      getFiles,
    })
    const store = setupStore()
    await store.start()
    expect(store.currentDir).toBe('docs/deep')
    expect(store.fileNames).toEqual(['needle.txt'])
  })

  it('sets the API URL', () => {
    const store = useIfmStore()
    store.setApiUrl('/api.php')
    expect(store.api.url).toBe('/api.php')
  })
})

describe('login', () => {
  it('starts the application after a successful login', async () => {
    const fetchMock = mockBackend({
      checkAuth: () => ({ status: 'OK' }),
      getFiles: () => [],
    })
    const store = setupStore()
    store.status = 'login'
    await expect(store.login('admin', 'secret')).resolves.toBeNull()
    expect(store.status).toBe('ready')
    const body = fetchMock.mock.calls[0]![1]!.body as URLSearchParams
    expect(body.get('inputLogin')).toBe('admin')
    expect(body.get('inputPassword')).toBe('secret')
  })

  it('returns the error message on failure', async () => {
    mockBackend({ checkAuth: () => ({ status: 'ERROR', message: 'Wrong credentials' }) })
    const store = setupStore()
    store.status = 'login'
    await expect(store.login('a', 'b')).resolves.toBe('Wrong credentials')
    expect(store.status).toBe('login')
  })

  it('falls back to generic messages', async () => {
    const store = setupStore()
    mockBackend({ checkAuth: () => ({ status: 'ERROR' }) })
    await expect(store.login('a', 'b')).resolves.toBe('Login failed.')
    mockBackend({ checkAuth: () => new Error('down') })
    await expect(store.login('a', 'b')).resolves.toBe('Authentication failed')
  })
})

describe('file table', () => {
  it('refreshes the file list and resets the selection', async () => {
    mockBackend({ getFiles: (p) => [rawFile(`in-${p.get('dir')}.txt`)] })
    const store = setupStore({ files: [rawFile('old.txt')], currentDir: 'x' })
    store.selected = [store.files[0]!.guid]
    store.highlighted = store.files[0]!.guid
    store.contextMenu = { x: 0, y: 0, guid: 'g' }
    await store.refreshFileTable()
    expect(store.fileNames).toEqual(['in-x.txt'])
    expect(store.selected).toEqual([])
    expect(store.highlighted).toBeNull()
    expect(store.contextMenu).toBeNull()
    expect(store.tasks).toEqual([])
  })

  it('reports errors while refreshing', async () => {
    const store = setupStore()
    mockBackend({ getFiles: () => ({ status: 'ERROR', message: 'Invalid directory given.' }) })
    await store.refreshFileTable()
    mockBackend({ getFiles: () => ({ status: 'ERROR' }) })
    await store.refreshFileTable()
    mockBackend({ getFiles: () => ({ unexpected: true }) })
    await store.refreshFileTable()
    mockBackend({ getFiles: () => new Error('down') })
    await store.refreshFileTable()
    expect(store.notifications.map((n) => [n.message, n.type])).toEqual([
      ['Invalid directory given.', 'e'],
      ['General error: No or broken response.', 'e'],
      ['Invalid data from server.', 'e'],
      ['General error: No or broken response.', 'e'],
    ])
  })

  it('changes the directory relative to the current one and pushes history', async () => {
    const realpath = vi.fn((p: URLSearchParams) => ({ realpath: `real/${p.get('dir')}` }))
    mockBackend({ getRealpath: realpath, getFiles: () => [] })
    const store = setupStore({ currentDir: 'a' })
    await store.changeDirectory('b')
    expect(realpath.mock.calls[0]![0].get('dir')).toBe('a/b')
    expect(store.currentDir).toBe('real/a/b')
    expect(window.location.hash).toBe('#real%2Fa%2Fb')
    expect(history.state).toEqual({ dir: 'real/a/b' })

    await store.changeDirectory('/abs', { absolute: true, pushState: false })
    expect(realpath.mock.calls[1]![0].get('dir')).toBe('/abs')
    expect(window.location.hash).toBe('#real%2Fa%2Fb')
  })

  it('reports errors when changing the directory', async () => {
    mockBackend({ getRealpath: () => new Error('down') })
    const store = setupStore({ currentDir: 'a' })
    await store.changeDirectory('b')
    expect(store.currentDir).toBe('a')
    expect(store.notifications[0]?.type).toBe('e')
  })

  it('toggles the selection, but never for the parent directory', () => {
    const store = setupStore({ files: [rawDir('..'), rawFile('a.txt')] })
    const [parent, file] = store.files
    store.toggleSelection(parent!.guid)
    expect(store.selected).toEqual([])
    store.toggleSelection(file!.guid)
    expect(store.isSelected(file!.guid)).toBe(true)
    expect(store.selectedItems).toEqual([file])
    store.toggleSelection(file!.guid)
    expect(store.selected).toEqual([])
    store.toggleSelection('unknown')
    expect(store.selected).toEqual([])
  })

  it('moves the highlight through the visible rows', () => {
    const store = setupStore()
    store.highlightItem('next')
    expect(store.highlighted).toBeNull()

    store.visibleGuids = ['a', 'b', 'c']
    store.highlightItem('next')
    expect(store.highlighted).toBe('a')
    store.highlightItem('prev')
    expect(store.highlighted).toBe('a')
    store.highlightItem('next')
    store.highlightItem('next')
    store.highlightItem('next')
    expect(store.highlighted).toBe('c')

    store.highlighted = null
    store.highlightItem('next', 'b')
    expect(store.highlighted).toBe('b')
    store.highlighted = 'gone'
    store.highlightItem('prev', 'unknown')
    expect(store.highlighted).toBe('a')
  })
})

describe('file operations', () => {
  it('opens the editor with the file content', async () => {
    mockBackend({
      getContent: (p) => ({
        status: 'OK',
        data: { filename: p.get('filename'), content: 'hello' },
      }),
    })
    const store = setupStore()
    await store.editFile('a.txt')
    expect(store.dialog).toEqual({
      name: 'file',
      props: { filename: 'a.txt', content: 'hello', isNew: false },
    })
  })

  it.each([
    [{ status: 'OK', data: { filename: 'a', content: null } }, 'Could not load content.'],
    [{ status: 'ERROR', message: 'nope' }, 'nope'],
    [{ status: 'ERROR' }, 'General error: No or broken response.'],
    [new Error('down'), 'This file cannot be displayed or edited.'],
  ])('reports editor load problems (%#)', async (response, message) => {
    mockBackend({ getContent: () => response })
    const store = setupStore()
    await store.editFile('a.txt')
    expect(store.dialog).toBeNull()
    expect(store.notifications[0]?.message).toBe(message)
  })

  it('opens an empty editor for new files', () => {
    const store = setupStore()
    store.newFile()
    expect(store.dialog).toEqual({
      name: 'file',
      props: { filename: 'newfile.txt', content: '', isNew: true },
    })
  })

  it.each([
    [
      'saveFile',
      (s: ReturnType<typeof setupStore>) => s.saveFile('a.txt', 'c'),
      'File saved.',
      { filename: 'a.txt', content: 'c' },
    ],
    [
      'createDir',
      (s: ReturnType<typeof setupStore>) => s.createDir('d'),
      'Directory created.',
      { dirname: 'd' },
    ],
    [
      'rename',
      (s: ReturnType<typeof setupStore>) => s.renameFile('a', 'b'),
      'File renamed.',
      { filename: 'a', newname: 'b' },
    ],
    [
      'changePermissions',
      (s: ReturnType<typeof setupStore>) => s.changePermissions('a', '644'),
      'Permissions changed.',
      { filename: 'a', chmod: '644' },
    ],
  ])('runs %s and refreshes on success', async (api, run, message, params) => {
    const handler = vi.fn((_p: URLSearchParams) => ({ status: 'OK', message: 'server says ok' }))
    const getFiles = vi.fn((_p: URLSearchParams) => [])
    mockBackend({ [api]: handler, getFiles })
    const store = setupStore({ currentDir: 'cur' })
    await expect(run(store)).resolves.toBe(true)
    const body = handler.mock.calls[0]![0] as URLSearchParams
    expect(body.get('dir')).toBe('cur')
    for (const [k, v] of Object.entries(params)) expect(body.get(k)).toBe(v)
    expect(store.notifications[0]).toMatchObject({ message, type: 's' })
    await flushPromises()
    expect(getFiles).toHaveBeenCalled()
  })

  it('reports failed actions without refreshing', async () => {
    const getFiles = vi.fn((_p: URLSearchParams) => [])
    mockBackend({ createDir: () => ({ status: 'ERROR', message: 'exists' }), getFiles })
    const store = setupStore()
    await expect(store.createDir('d')).resolves.toBe(false)
    expect(store.notifications[0]).toMatchObject({ message: 'exists', type: 'e' })
    mockBackend({ createDir: () => ({ status: 'ERROR' }), getFiles })
    await store.createDir('d')
    mockBackend({ createDir: () => new Error('down'), getFiles })
    await expect(store.createDir('d')).resolves.toBe(false)
    expect(store.notifications.map((n) => n.message)).toEqual([
      'exists',
      'General error: No or broken response.',
      'General error: No or broken response.',
    ])
    expect(getFiles).not.toHaveBeenCalled()
  })

  it('deletes files', async () => {
    const del = vi.fn((_p: URLSearchParams) => ({ status: 'OK' }))
    mockBackend({ delete: del, getFiles: () => [] })
    const store = setupStore({ files: [rawFile('a'), rawFile('b')] })
    await store.deleteFiles(store.files)
    expect((del.mock.calls[0]![0] as URLSearchParams).getAll('filenames[]')).toEqual(['a', 'b'])
    expect(store.notifications[0]?.message).toBe('Files deleted.')
  })

  it('copies/moves files as a task and refreshes even on errors', async () => {
    let resolveCopy: (v: unknown) => void = () => {}
    const copyMove = vi.fn((_p: URLSearchParams) => new Promise((r) => (resolveCopy = r)))
    const getFiles = vi.fn((_p: URLSearchParams) => [])
    mockBackend({ copyMove, getFiles })
    const store = setupStore({ files: [rawFile('a'), rawFile('b')] })

    const done = store.copyMove([store.files[0]!], '/dest', 'copy')
    await flushPromises()
    expect(store.tasks[0]?.name).toBe('Copy a to /dest')
    resolveCopy({ status: 'ERROR', message: 'failed<ul><li>a</li></ul>' })
    await done
    await flushPromises()
    expect(store.tasks).toEqual([])
    expect(store.notifications[0]).toMatchObject({ type: 'e' })
    expect(getFiles).toHaveBeenCalled()

    const body = copyMove.mock.calls[0]![0] as unknown as URLSearchParams
    expect(body.get('action')).toBe('copy')
    expect(body.get('destination')).toBe('/dest')

    const second = store.copyMove(['a', 'b'], 'docs', 'move')
    await flushPromises()
    expect(store.tasks[0]?.name).toBe('Move 2 to docs')
    resolveCopy({ status: 'OK', message: 'Files moved.' })
    await second
    expect(store.notifications[1]).toMatchObject({ message: 'Files moved.', type: 's' })
  })

  it('extracts archives and creates archives', async () => {
    const extract = vi.fn((_p: URLSearchParams) => ({
      status: 'OK',
      message: 'Archive extracted.',
    }))
    const createArchive = vi.fn((_p: URLSearchParams) => ({
      status: 'OK',
      message: 'Archive created.',
    }))
    mockBackend({ extract, createArchive, getFiles: () => [] })
    const store = setupStore({ files: [rawFile('a'), rawFile('b')] })

    await store.extractFile('x.zip', './x')
    expect((extract.mock.calls[0]![0] as URLSearchParams).get('targetdir')).toBe('./x')

    expect(store.createArchive(store.files, 'bad.rar')).toBe(false)
    expect(store.notifications.at(-1)?.message).toMatch(/Invalid archive format/)
    expect(createArchive).not.toHaveBeenCalled()

    expect(store.createArchive(store.files, 'out.tar.gz')).toBe(true)
    await flushPromises()
    const body = createArchive.mock.calls[0]![0] as URLSearchParams
    expect(body.get('format')).toBe('tar.gz')
    expect(body.getAll('filenames[]')).toEqual(['a', 'b'])
    expect(store.notifications.at(-1)?.message).toBe('Archive created.')
  })

  it('uploads files from remote URLs', async () => {
    const remoteUpload = vi.fn((_p: URLSearchParams) => ({ status: 'OK' }))
    mockBackend({ remoteUpload, getFiles: () => [] })
    const store = setupStore()
    await store.remoteUpload('https://x/y.zip', 'y.zip', 'curl')
    const body = remoteUpload.mock.calls[0]![0] as URLSearchParams
    expect([body.get('url'), body.get('filename'), body.get('method')]).toEqual([
      'https://x/y.zip',
      'y.zip',
      'curl',
    ])
    expect(store.notifications[0]?.message).toBe('File uploaded.')
  })

  it('searches files', async () => {
    mockBackend({ searchItems: () => [rawFile('./docs/a.txt')] })
    const store = setupStore({ currentDir: 'cur' })
    await expect(store.searchItems('a*')).resolves.toBe(true)
    expect(store.lastSearch).toBe('a*')
    expect(store.searchDir).toBe('cur')
    expect(store.searchResults?.[0]).toMatchObject({ folder: './docs', linkname: 'a.txt' })

    mockBackend({
      searchItems: () => ({ status: 'ERROR', message: 'Pattern cannot contain slashes.' }),
    })
    await expect(store.searchItems('a/b')).resolves.toBe(false)
    mockBackend({ searchItems: () => ({ status: 'ERROR' }) })
    await expect(store.searchItems('x')).resolves.toBe(false)
    mockBackend({ searchItems: () => new Error('down') })
    await expect(store.searchItems('x')).resolves.toBe(false)
    expect(store.notifications.map((n) => n.message)).toEqual([
      'Pattern cannot contain slashes.',
      'General error: No or broken response.',
      'General error: No or broken response.',
    ])
  })

  it('loads folders', async () => {
    const getFolders = vi.fn((_p: URLSearchParams) => [{ text: 'a', dataAttr: { path: '/a' } }])
    mockBackend({ getFolders })
    const store = setupStore()
    await expect(store.getFolders()).resolves.toHaveLength(1)
    await store.getFolders('/a')
    expect((getFolders.mock.calls[0]![0] as URLSearchParams).has('dir')).toBe(false)
    expect((getFolders.mock.calls[1]![0] as URLSearchParams).get('dir')).toBe('/a')
  })
})

describe('uploads', () => {
  class FakeXhr {
    static instances: FakeXhr[] = []
    static respond: (xhr: FakeXhr) => void = () => {}
    upload: { onprogress?: (e: Partial<ProgressEvent>) => void } = {}
    onload?: () => void
    onerror?: () => void
    status = 200
    responseText = ''
    body: FormData | null = null
    constructor() {
      FakeXhr.instances.push(this)
    }
    open() {}
    setRequestHeader() {}
    send(body: FormData) {
      this.body = body
      queueMicrotask(() => FakeXhr.respond(this))
    }
  }

  beforeEach(() => {
    FakeXhr.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })

  const file = (name: string) => new File(['data'], name)

  it('uploads a file with progress and refreshes the current directory', async () => {
    const getFiles = vi.fn((_p: URLSearchParams) => [])
    mockBackend({ getFiles })
    const store = setupStore({ currentDir: 'cur' })
    const progress: number[] = []
    FakeXhr.respond = (xhr) => {
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 })
      progress.push(store.tasks[0]!.progress)
      xhr.responseText = JSON.stringify({ status: 'OK', cd: 'cur' })
      xhr.onload?.()
    }
    await store.uploadFile(file('a.txt'), 'renamed.txt')
    await flushPromises()
    const body = FakeXhr.instances[0]!.body!
    expect(body.get('dir')).toBe('cur')
    expect(body.get('newfilename')).toBe('renamed.txt')
    expect((body.get('file') as File).name).toBe('a.txt')
    expect(progress).toEqual([25])
    expect(store.tasks).toEqual([])
    expect(store.notifications[0]?.message).toBe('File uploaded.')
    expect(getFiles).toHaveBeenCalled()
  })

  it('does not refresh if the directory changed meanwhile', async () => {
    const getFiles = vi.fn((_p: URLSearchParams) => [])
    mockBackend({ getFiles })
    const store = setupStore({ currentDir: 'cur' })
    FakeXhr.respond = (xhr) => {
      xhr.responseText = JSON.stringify({ status: 'OK', cd: 'other' })
      xhr.onload?.()
    }
    await store.uploadFile(file('a.txt'))
    expect(FakeXhr.instances[0]!.body!.has('newfilename')).toBe(false)
    await flushPromises()
    expect(getFiles).not.toHaveBeenCalled()
  })

  it('reports upload errors', async () => {
    const store = setupStore()
    FakeXhr.respond = (xhr) => {
      xhr.responseText = JSON.stringify({ status: 'ERROR', message: 'Invalid filename given.' })
      xhr.onload?.()
    }
    await store.uploadFile(file('a'))
    FakeXhr.respond = (xhr) => {
      xhr.responseText = JSON.stringify({ status: 'ERROR' })
      xhr.onload?.()
    }
    await store.uploadFile(file('a'))
    FakeXhr.respond = (xhr) => xhr.onerror?.()
    await store.uploadFile(file('a'))
    expect(store.notifications.map((n) => n.message)).toEqual([
      'Invalid filename given.',
      'General error: No or broken response.',
      'General error: No or broken response.',
    ])
  })

  const uploaded = () =>
    FakeXhr.instances.map((x) => [
      (x.body!.get('file') as File).name,
      x.body!.get('newfilename') ?? undefined,
    ])

  it('asks before overwriting existing files', async () => {
    FakeXhr.respond = (xhr) => {
      xhr.responseText = '{"status":"OK"}'
      xhr.onload?.()
    }
    const store = setupStore({ files: [rawFile('a.txt'), rawFile('b.txt')] })

    const files = [file('a.txt'), file('c.txt')]
    store.uploadFiles(files)
    expect(store.dialog).toEqual({
      name: 'uploadConfirmOverwrite',
      props: { files, existing: ['a.txt'], newfilename: undefined },
    })
    expect(FakeXhr.instances).toEqual([])

    store.uploadFiles([file('x.txt')], 'b.txt')
    expect(store.dialog?.props).toMatchObject({ existing: ['b.txt'], newfilename: 'b.txt' })

    store.closeDialog()
    store.uploadFiles([file('a.txt')], undefined, true)
    await flushPromises()
    expect(uploaded()).toEqual([['a.txt', undefined]])
    expect(store.dialog).toBeNull()
  })

  it('uploads directly without conflicts or confirmation', async () => {
    FakeXhr.respond = (xhr) => {
      xhr.responseText = '{"status":"OK"}'
      xhr.onload?.()
    }
    const store = setupStore({ files: [rawFile('a.txt')] })
    store.uploadFiles([file('new.txt')], 'other.txt')
    store.uploadFiles([file('x'), file('y')])
    store.config.confirmoverwrite = 0
    store.uploadFiles([file('a.txt')])
    await flushPromises()
    expect(uploaded()).toEqual([
      ['new.txt', 'other.txt'],
      ['x', undefined],
      ['y', undefined],
      ['a.txt', undefined],
    ])
    expect(store.dialog).toBeNull()
  })
})

describe('helpers', () => {
  it('manages notifications, tasks and dialogs', () => {
    const store = setupStore()
    store.notify('hi')
    expect(store.notifications[0]).toMatchObject({ message: 'hi', type: 'i' })
    store.dismiss(store.notifications[0]!.id)
    expect(store.notifications).toEqual([])

    const id = store.addTask('work', 'warning')
    store.updateTask(id, 42)
    store.updateTask('unknown', 1)
    expect(store.tasks[0]).toMatchObject({ name: 'work', type: 'warning', progress: 42 })
    store.removeTask(id)
    expect(store.tasks).toEqual([])

    store.contextMenu = { x: 1, y: 2, guid: 'g' }
    const key = store.dialogKey
    store.openDialog('createDir', {})
    expect(store.contextMenu).toBeNull()
    expect(store.dialogKey).toBe(key + 1)
    store.closeDialog()
    expect(store.dialog).toBeNull()
  })

  it('translates with fallbacks', () => {
    const store = setupStore()
    store.i18n = {}
    expect(store.t('general_error')).toBe('General error: No or broken response.')
    expect(store.t('unknown_key')).toBe('unknown_key')
  })

  it('logs only in debug mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const store = setupStore()
    store.log('quiet')
    expect(spy).not.toHaveBeenCalled()
    store.config.debug = 1
    store.log('loud')
    expect(spy).toHaveBeenCalledWith('IFM (debug):', 'loud')
  })

  it('derives the ace modes from the compiled ace files', () => {
    const store = setupStore()
    expect(store.aceModes).toEqual([])
    store.config.ace_includes = '|ext-modelist|mode-php|mode-json|theme-monokai'
    expect(store.aceFiles).toEqual(['ext-modelist', 'mode-php', 'mode-json', 'theme-monokai'])
    expect(store.aceModes).toEqual(['text', 'php', 'json'])
  })

  it('finds the highlighted item', () => {
    const store = setupStore({ files: [rawFile('a')] })
    expect(store.highlightedItem).toBeNull()
    store.highlighted = store.files[0]!.guid
    expect(store.highlightedItem?.name).toBe('a')
  })
})
