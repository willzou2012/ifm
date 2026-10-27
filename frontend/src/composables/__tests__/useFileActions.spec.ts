import { afterEach, describe, expect, it, vi } from 'vitest'
import { rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import * as clipboard from '@/utils/clipboard'
import { useFileActions } from '../useFileActions'

afterEach(() => vi.unstubAllGlobals())

function setup(config = {}) {
  const store = setupStore({
    config,
    files: [
      rawDir('..'),
      rawDir('docs'),
      rawFile('a.txt'),
      rawFile('b.zip', { ext: 'zip', mime_type: 'application/zip' }),
      rawFile('c.png', { mime_type: 'image/png' }),
    ],
  })
  const [parent, dir, text, zip, png] = store.files
  return {
    store,
    actions: useFileActions(),
    parent: parent!,
    dir: dir!,
    text: text!,
    zip: zip!,
    png: png!,
  }
}

const ids = (groups: { id: string; badge?: number }[][]) => groups.map((g) => g.map((a) => a.id))

describe('runItemAction', () => {
  it('opens the matching dialogs', () => {
    const { store, actions, text, zip } = setup()
    const edit = vi.spyOn(store, 'editFile').mockResolvedValue()
    actions.runItemAction('rename', text)
    expect(store.dialog).toEqual({ name: 'rename', props: { filename: 'a.txt' } })
    actions.runItemAction('extract', zip)
    expect(store.dialog).toEqual({ name: 'extract', props: { filename: 'b.zip' } })
    actions.runItemAction('delete', text)
    expect(store.dialog).toEqual({ name: 'delete', props: { items: [text] } })
    actions.runItemAction('copymove', text)
    expect(store.dialog).toEqual({ name: 'copyMove', props: { items: [text] } })
    actions.runItemAction('edit', text)
    expect(edit).toHaveBeenCalledWith('a.txt')
  })
})

describe('context menu', () => {
  it('is enabled only with contextmenu and at least one action', () => {
    expect(setup().actions.contextMenuEnabled()).toBe(true)
    expect(setup({ contextmenu: 0 }).actions.contextMenuEnabled()).toBe(false)
    const none = { edit: 0, extract: 0, rename: 0, copymove: 0, download: 0, delete: 0 }
    expect(setup(none).actions.contextMenuEnabled()).toBe(false)
  })

  it('shows item specific entries', () => {
    const { actions, text, zip, png, dir, parent } = setup()
    expect(ids(actions.contextMenuGroups(text, []))).toEqual([
      ['edit', 'rename', 'copylink'],
      ['copymove', 'download', 'createarchive', 'delete'],
    ])
    expect(ids(actions.contextMenuGroups(zip, []))[0]).toEqual(['extract', 'rename', 'copylink'])
    expect(ids(actions.contextMenuGroups(png, []))[0]).toEqual(['rename', 'copylink'])
    expect(ids(actions.contextMenuGroups(dir, []))[0]).toEqual(['rename', 'copylink'])
    expect(ids(actions.contextMenuGroups(parent, []))).toEqual([['download']])
  })

  it('shows multi selection entries with badges', () => {
    const { actions, text, zip } = setup()
    const groups = actions.contextMenuGroups(text, [text, zip])
    expect(ids(groups)).toEqual([['copymove', 'download', 'createarchive', 'delete']])
    expect(groups[0]!.map((a) => a.badge)).toEqual([2, 2, 2, 2])
    expect(groups[0]![0]!.label).toBe('Copy/Move')
  })

  it('hides disabled features', () => {
    const { actions, text } = setup({ edit: 0, rename: 0, download: 0, createarchive: 0 })
    expect(ids(actions.contextMenuGroups(text, []))).toEqual([['copylink'], ['copymove', 'delete']])
  })

  it('runs the entries', async () => {
    const { store, actions, text, zip } = setup()
    const edit = vi.spyOn(store, 'editFile').mockResolvedValue()
    const copy = vi.spyOn(clipboard, 'copyToClipboard').mockResolvedValue()
    const assign = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      assign,
      origin: 'http://h',
      pathname: '/ifm.php',
    })

    await actions.runContextAction('edit', text, [])
    expect(edit).toHaveBeenCalledWith('a.txt')
    await actions.runContextAction('extract', zip, [])
    expect(store.dialog).toMatchObject({ name: 'extract', props: { filename: 'b.zip' } })
    await actions.runContextAction('rename', text, [])
    expect(store.dialog).toMatchObject({ name: 'rename' })
    await actions.runContextAction('copylink', text, [])
    expect(copy).toHaveBeenCalledWith('http://h/a.txt')
    await actions.runContextAction('copymove', text, [])
    expect(store.dialog).toEqual({ name: 'copyMove', props: { items: [text] } })
    await actions.runContextAction('copymove', text, [text, zip])
    expect(store.dialog).toEqual({ name: 'copyMove', props: { items: [text, zip] } })
    await actions.runContextAction('createarchive', text, [])
    expect(store.dialog).toEqual({ name: 'createArchive', props: { items: [text] } })
    await actions.runContextAction('delete', text, [zip])
    expect(store.dialog).toEqual({ name: 'delete', props: { items: [zip] } })

    await actions.runContextAction('download', text, [])
    expect(assign).toHaveBeenCalledWith(text.download.link)
    await actions.runContextAction('download', text, [text, zip])
    expect(store.notifications[0]?.message).toMatch(/not possible to download a set of files/)
  })
})
