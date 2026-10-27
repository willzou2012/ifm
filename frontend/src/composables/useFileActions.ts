import { useIfmStore } from '@/stores/ifm'
import type { FileAction, FileItem } from '@/types'
import { absoluteLink } from '@/utils/files'
import { copyToClipboard } from '@/utils/clipboard'

export type ContextActionId =
  'edit' | 'extract' | 'rename' | 'copylink' | 'copymove' | 'download' | 'createarchive' | 'delete'

export interface ContextAction {
  id: ContextActionId
  label: string
  icon: string
  /** number of selected items, shown as a badge for multi-item actions */
  badge?: number
}

/**
 * Item level actions shared by the row buttons, the context menu and the
 * keyboard shortcuts.
 */
export function useFileActions() {
  const store = useIfmStore()

  function runItemAction(action: FileAction, item: FileItem) {
    switch (action) {
      case 'rename':
        store.openDialog('rename', { filename: item.name })
        break
      case 'extract':
        store.openDialog('extract', { filename: item.name })
        break
      case 'edit':
        void store.editFile(item.name)
        break
      case 'delete':
        store.openDialog('delete', { items: [item] })
        break
      case 'copymove':
        store.openDialog('copyMove', { items: [item] })
        break
    }
  }

  /** Whether the context menu is enabled at all. */
  function contextMenuEnabled(): boolean {
    const c = store.config
    return !!(
      c.contextmenu &&
      (c.edit || c.extract || c.rename || c.copymove || c.download || c.delete)
    )
  }

  /** Visible context menu entries in their groups (empty groups are dropped). */
  function contextMenuGroups(clicked: FileItem, selected: FileItem[]): ContextAction[][] {
    const c = store.config
    const t = store.t
    const n = selected.length
    const multi = n > 0
    const badge = multi ? n : undefined
    const notParent = clicked.name !== '..'

    const groups: [ContextAction, boolean][][] = [
      [
        [
          { id: 'edit', label: t('edit'), icon: 'icon fa fa-fw fa-pencil' },
          !!(c.edit && clicked.eaction === 'edit' && !multi),
        ],
        [
          { id: 'extract', label: t('extract'), icon: 'icon fa fa-fw fa-file-archive-o' },
          !!(c.extract && clicked.eaction === 'extract' && !multi),
        ],
        [
          { id: 'rename', label: t('rename'), icon: 'icon fa fa-fw fa-terminal' },
          !!(c.rename && !multi && notParent),
        ],
        [
          { id: 'copylink', label: t('copylink'), icon: 'icon fa fa-fw fa-external-link' },
          !multi && notParent,
        ],
      ],
      [
        [
          {
            id: 'copymove',
            label: `${t('copy')}/${t('move')}`,
            icon: 'icon fa fa-fw fa-files-o',
            badge,
          },
          !!(c.copymove && notParent),
        ],
        [
          { id: 'download', label: t('download'), icon: 'icon fa fa-fw fa-download', badge },
          !!c.download,
        ],
        [
          {
            id: 'createarchive',
            label: t('create_archive'),
            icon: 'icon fa fa-fw fa-file-archive-o',
            badge,
          },
          !!(c.createarchive && notParent),
        ],
        [
          { id: 'delete', label: t('delete'), icon: 'icon fa fa-fw fa-trash', badge },
          !!(c.delete && notParent),
        ],
      ],
    ]

    return groups
      .map((g) => g.filter(([, shown]) => shown).map(([action]) => action))
      .filter((g) => g.length > 0)
  }

  async function runContextAction(id: ContextActionId, clicked: FileItem, selected: FileItem[]) {
    const items = selected.length > 0 ? selected : [clicked]
    switch (id) {
      case 'edit':
        await store.editFile(clicked.name)
        break
      case 'extract':
        store.openDialog('extract', { filename: clicked.name })
        break
      case 'rename':
        store.openDialog('rename', { filename: clicked.name })
        break
      case 'copylink':
        await copyToClipboard(absoluteLink(clicked.link))
        break
      case 'copymove':
        store.openDialog('copyMove', { items })
        break
      case 'download':
        if (selected.length > 0)
          store.notify('At the moment it is not possible to download a set of files.')
        else window.location.assign(clicked.download.link)
        break
      case 'createarchive':
        store.openDialog('createArchive', { items })
        break
      case 'delete':
        store.openDialog('delete', { items })
        break
    }
  }

  return { runItemAction, contextMenuEnabled, contextMenuGroups, runContextAction }
}
