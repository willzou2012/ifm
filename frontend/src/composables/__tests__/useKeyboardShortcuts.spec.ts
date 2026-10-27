import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import { handleKeystroke, useKeyboardShortcuts } from '../useKeyboardShortcuts'

afterEach(() => {
  document.body.innerHTML = ''
})

function key(k: string, init: KeyboardEventInit = {}, target?: HTMLElement) {
  const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...init })
  if (target) Object.defineProperty(e, 'target', { value: target })
  return e
}

function setup(config = {}) {
  const store = setupStore({
    config,
    files: [rawDir('..'), rawDir('docs'), rawFile('a.txt'), rawFile('b.zip', { ext: 'zip' })],
  })
  store.visibleGuids = store.files.map((f) => f.guid)
  const [parent, dir, text, zip] = store.files
  vi.spyOn(store, 'changeDirectory').mockResolvedValue()
  vi.spyOn(store, 'refreshFileTable').mockResolvedValue()
  vi.spyOn(store, 'editFile').mockResolvedValue()
  return { store, parent: parent!, dir: dir!, text: text!, zip: zip! }
}

/** Renders the item link of a file and focuses it, like the file table does. */
function focusItem(guid: string) {
  const a = document.createElement('a')
  a.id = guid
  a.className = 'ifmitem'
  a.tabIndex = 0
  document.body.appendChild(a)
  a.focus()
  return a
}

describe('handleKeystroke', () => {
  it('opens dialogs with global shortcuts', () => {
    const { store } = setup()
    const cases: [string, string][] = [
      ['/', 'search'],
      ['u', 'upload'],
      ['o', 'remoteUpload'],
      ['a', 'ajaxRequest'],
      ['F', 'file'],
      ['D', 'createDir'],
    ]
    for (const [k, dialog] of cases) {
      store.closeDialog()
      const e = key(k)
      handleKeystroke(e, store)
      expect(store.dialog?.name).toBe(dialog)
      expect(e.defaultPrevented).toBe(true)
    }
  })

  it('ignores shortcuts of disabled features', () => {
    const { store } = setup({
      search: 0,
      upload: 0,
      remoteupload: 0,
      ajaxrequest: 0,
      createfile: 0,
      createdir: 0,
      showrefresh: 0,
    })
    for (const k of ['/', 'u', 'o', 'a', 'F', 'D', 'r']) {
      const e = key(k)
      handleKeystroke(e, store)
      expect(e.defaultPrevented).toBe(false)
    }
    expect(store.dialog).toBeNull()
    expect(store.refreshFileTable).not.toHaveBeenCalled()
  })

  it('ignores keys in form fields, with modifiers, in dialogs and before start', () => {
    const { store } = setup()
    const input = document.createElement('input')
    handleKeystroke(key('u', {}, input), store)
    handleKeystroke(key('u', { ctrlKey: true }), store)
    expect(store.dialog).toBeNull()
    store.openDialog('createDir', {})
    handleKeystroke(key('u'), store)
    expect(store.dialog?.name).toBe('createDir')
    store.closeDialog()
    store.status = 'login'
    handleKeystroke(key('u'), store)
    expect(store.dialog).toBeNull()
  })

  it('refreshes, focuses the path and navigates up', () => {
    const { store } = setup()
    handleKeystroke(key('r'), store)
    expect(store.refreshFileTable).toHaveBeenCalled()

    const input = document.createElement('input')
    input.id = 'currentDir'
    document.body.appendChild(input)
    handleKeystroke(key('g'), store)
    expect(document.activeElement).toBe(input)

    for (const k of ['h', 'ArrowLeft', 'Backspace']) handleKeystroke(key(k), store)
    expect(store.changeDirectory).toHaveBeenCalledTimes(3)
    expect(store.changeDirectory).toHaveBeenCalledWith('..')
  })

  it('moves the highlight', () => {
    const { store, parent, dir, text } = setup()
    handleKeystroke(key('j'), store)
    expect(store.highlighted).toBe(parent.guid)
    handleKeystroke(key('ArrowDown'), store)
    expect(store.highlighted).toBe(dir.guid)
    handleKeystroke(key('k'), store)
    handleKeystroke(key('ArrowUp'), store)
    expect(store.highlighted).toBe(parent.guid)

    // starts at the focused item
    store.highlighted = null
    focusItem(text.guid)
    handleKeystroke(key('j'), store)
    expect(store.highlighted).toBe(text.guid)
  })

  it('works on the selection or the highlighted item', () => {
    const { store, parent, text, zip } = setup()
    handleKeystroke(key('Delete'), store)
    expect(store.dialog).toBeNull()

    store.highlighted = parent.guid
    handleKeystroke(key('Delete'), store)
    handleKeystroke(key('c'), store)
    expect(store.dialog).toBeNull()

    store.highlighted = text.guid
    handleKeystroke(key('Delete'), store)
    expect(store.dialog).toEqual({ name: 'delete', props: { items: [text] } })
    store.closeDialog()
    handleKeystroke(key('m'), store)
    expect(store.dialog).toEqual({ name: 'copyMove', props: { items: [text] } })
    store.closeDialog()

    store.selected = [zip.guid]
    handleKeystroke(key('c'), store)
    expect(store.dialog).toEqual({ name: 'copyMove', props: { items: [zip] } })
    store.closeDialog()
    handleKeystroke(key('Delete'), store)
    expect(store.dialog).toEqual({ name: 'delete', props: { items: [zip] } })
  })

  it('handles item keys', () => {
    const { store, parent, dir, text, zip } = setup()
    handleKeystroke(key('l'), store)
    expect(store.changeDirectory).not.toHaveBeenCalled()

    store.highlighted = dir.guid
    handleKeystroke(key('l'), store)
    handleKeystroke(key('ArrowRight'), store)
    expect(store.changeDirectory).toHaveBeenCalledWith('docs')
    store.highlighted = text.guid
    handleKeystroke(key('l'), store)
    expect(store.changeDirectory).toHaveBeenCalledTimes(2)

    handleKeystroke(key('e'), store)
    expect(store.editFile).toHaveBeenCalledWith('a.txt')
    store.highlighted = zip.guid
    handleKeystroke(key('e'), store)
    expect(store.dialog).toEqual({ name: 'extract', props: { filename: 'b.zip' } })
    store.closeDialog()

    handleKeystroke(key('n'), store)
    expect(store.dialog).toEqual({ name: 'rename', props: { filename: 'b.zip' } })
    store.closeDialog()
    store.highlighted = parent.guid
    handleKeystroke(key('n'), store)
    expect(store.dialog).toBeNull()
  })

  it('handles Enter, space and Escape on the focused item', () => {
    const { store, dir, text, parent } = setup()
    store.highlighted = dir.guid
    // without focus nothing happens
    handleKeystroke(key('Enter'), store)
    handleKeystroke(key('Escape'), store)
    expect(store.changeDirectory).not.toHaveBeenCalled()
    expect(store.highlighted).toBe(dir.guid)

    focusItem(dir.guid)
    handleKeystroke(key('Enter'), store)
    expect(store.changeDirectory).toHaveBeenCalledWith('docs')

    store.highlighted = text.guid
    focusItem(text.guid)
    const enterOnFile = key('Enter')
    handleKeystroke(enterOnFile, store)
    expect(enterOnFile.defaultPrevented).toBe(false)
    handleKeystroke(key(' '), store)
    expect(store.selected).toEqual([text.guid])
    handleKeystroke(key('Escape'), store)
    expect(store.highlighted).toBeNull()

    store.highlighted = parent.guid
    focusItem(parent.guid)
    handleKeystroke(key(' '), store)
    expect(store.selected).toEqual([text.guid])
    handleKeystroke(key('x'), store)
  })
})

describe('useKeyboardShortcuts', () => {
  it('listens on the document while mounted', () => {
    const { store } = setup()
    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts()
        return () => h('div')
      },
    })
    const wrapper = mount(Comp)
    document.dispatchEvent(key('u'))
    expect(store.dialog?.name).toBe('upload')
    store.closeDialog()
    wrapper.unmount()
    document.dispatchEvent(key('u'))
    expect(store.dialog).toBeNull()
  })
})
