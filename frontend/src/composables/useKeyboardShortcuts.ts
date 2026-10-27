import { onBeforeUnmount, onMounted } from 'vue'
import { useIfmStore } from '@/stores/ifm'

function isFormElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable
}

/** guid of the file table item whose link currently has the focus */
function focusedItemGuid(): string | null {
  const el = document.activeElement
  return el instanceof HTMLElement && el.classList.contains('ifmitem') ? el.id : null
}

/**
 * Global keyboard shortcuts of the file table (vim-like and arrow keys).
 * Shortcuts are ignored while typing in a form field or while a dialog is open.
 */
export function handleKeystroke(e: KeyboardEvent, store = useIfmStore()) {
  if (isFormElement(e.target) || store.dialog || store.status !== 'ready') return
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const c = store.config

  const run = (enabled: unknown, fn: () => void) => {
    if (!enabled) return
    e.preventDefault()
    fn()
  }

  // global key events
  switch (e.key) {
    case '/':
      return run(c.search, () => store.openDialog('search', {}))
    case 'g':
      return run(true, () => document.getElementById('currentDir')?.focus())
    case 'r':
      return run(c.showrefresh, () => void store.refreshFileTable())
    case 'u':
      return run(c.upload, () => store.openDialog('upload', {}))
    case 'o':
      return run(c.remoteupload, () => store.openDialog('remoteUpload', {}))
    case 'a':
      return run(c.ajaxrequest, () => store.openDialog('ajaxRequest', {}))
    case 'F':
      return run(c.createfile, () => store.newFile())
    case 'D':
      return run(c.createdir, () => store.openDialog('createDir', {}))
    case 'h':
    case 'ArrowLeft':
    case 'Backspace':
      return run(true, () => void store.changeDirectory('..'))
    case 'j':
    case 'ArrowDown':
      return run(true, () => store.highlightItem('next', focusedItemGuid()))
    case 'k':
    case 'ArrowUp':
      return run(true, () => store.highlightItem('prev', focusedItemGuid()))
  }

  // key events which work on the selection or the highlighted item; some of
  // them are ignored if the highlighted item is the parent directory
  const item = store.highlightedItem
  const selectedItems = store.selectedItems
  const target = selectedItems.length > 0 ? selectedItems : item && !item.isParent ? [item] : []

  switch (e.key) {
    case 'Delete':
      return run(c.delete && target.length > 0, () => store.openDialog('delete', { items: target }))
    case 'c':
    case 'm':
      return run(c.copymove && target.length > 0, () =>
        store.openDialog('copyMove', { items: target }),
      )
  }

  if (!item) return
  const itemHasFocus = focusedItemGuid() === item.guid

  switch (e.key) {
    case 'l':
    case 'ArrowRight':
      e.preventDefault()
      if (item.type === 'dir') void store.changeDirectory(item.name)
      return
    case 'Escape':
      return run(itemHasFocus, () => (store.highlighted = null))
    case 'Enter':
      if (itemHasFocus && item.type === 'dir') {
        e.preventDefault()
        e.stopPropagation()
        void store.changeDirectory(item.name)
      }
      return
    case ' ':
      if (itemHasFocus && !item.isParent) {
        e.preventDefault()
        e.stopPropagation()
        store.toggleSelection(item.guid)
      }
      return
    case 'e':
      if (c.edit && item.eaction === 'edit') return run(true, () => void store.editFile(item.name))
      return run(c.extract && item.eaction === 'extract', () =>
        store.openDialog('extract', { filename: item.name }),
      )
    case 'n':
      e.preventDefault()
      if (c.rename && !item.isParent) store.openDialog('rename', { filename: item.name })
      return
  }
}

export function useKeyboardShortcuts() {
  const store = useIfmStore()
  const listener = (e: KeyboardEvent) => handleKeystroke(e, store)
  onMounted(() => document.addEventListener('keydown', listener))
  onBeforeUnmount(() => document.removeEventListener('keydown', listener))
}
