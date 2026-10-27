import { computed, markRaw, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { ApiClient, type Params } from '@/api/client'
import type {
  ApiStatus,
  FileItem,
  FolderNode,
  I18n,
  IfmConfig,
  MessageType,
  Notification,
  RawFileItem,
  SearchResult,
  Task,
  TaskType,
} from '@/types'
import {
  archiveFormat,
  decorateItem,
  decorateSearchResult,
  type DecorateContext,
} from '@/utils/files'
import { generateGuid } from '@/utils/guid'
import { pathCombine } from '@/utils/path'

/** Every dialog with the props it is opened with. */
export type DialogState =
  | { name: 'file'; props: { filename: string; content: string; isNew: boolean } }
  | { name: 'createDir'; props: Record<string, never> }
  | { name: 'delete'; props: { items: FileItem[] } }
  | { name: 'rename'; props: { filename: string } }
  | { name: 'copyMove'; props: { items: FileItem[] } }
  | { name: 'extract'; props: { filename: string } }
  | { name: 'upload'; props: Record<string, never> }
  | {
      name: 'uploadConfirmOverwrite'
      props: { files: File[]; existing: string[]; newfilename?: string }
    }
  | { name: 'remoteUpload'; props: Record<string, never> }
  | { name: 'ajaxRequest'; props: Record<string, never> }
  | { name: 'search'; props: Record<string, never> }
  | { name: 'createArchive'; props: { items: FileItem[] } }

export type DialogName = DialogState['name']
type DialogProps<N extends DialogName> = Extract<DialogState, { name: N }>['props']

export type AppStatus = 'loading' | 'login' | 'ready' | 'error'

export interface ContextMenuState {
  x: number
  y: number
  guid: string
}

/** English fallbacks, used before the translations are loaded. */
const FALLBACK_I18N: I18n = {
  general_error: 'General error: No or broken response.',
  load_config_error: 'Could not load configuration.',
  load_text_error: 'Could not load texts.',
}

export const useIfmStore = defineStore('ifm', () => {
  // ---------------------------------------------------------------------------
  // state
  // ---------------------------------------------------------------------------
  const api = shallowRef(markRaw(new ApiClient(window.location.href.replace(/#.*/, ''))))
  const status = ref<AppStatus>('loading')
  const initError = ref('')
  const config = ref<IfmConfig>({})
  const i18n = ref<I18n>({})

  const currentDir = ref('')
  const files = ref<FileItem[]>([])
  /** guids of the rows in the order they are currently displayed */
  const visibleGuids = ref<string[]>([])
  const selected = ref<string[]>([])
  const highlighted = ref<string | null>(null)

  const tasks = ref<Task[]>([])
  const notifications = ref<Notification[]>([])
  const dialog = shallowRef<DialogState | null>(null)
  /** incremented with every opened dialog, so each one gets fresh component state */
  const dialogKey = ref(0)
  const contextMenu = ref<ContextMenuState | null>(null)

  const lastSearch = ref('')
  const searchResults = ref<SearchResult[] | null>(null)
  const searchDir = ref('')

  // ---------------------------------------------------------------------------
  // getters
  // ---------------------------------------------------------------------------
  const isMobile = typeof (window as { orientation?: unknown }).orientation !== 'undefined'

  function t(key: string): string {
    return i18n.value[key] ?? FALLBACK_I18N[key] ?? key
  }

  const fileNames = computed(() => files.value.map((f) => f.name))
  const selectedItems = computed(() =>
    selected.value
      .map((guid) => files.value.find((f) => f.guid === guid))
      .filter((f): f is FileItem => f !== undefined),
  )
  const highlightedItem = computed(
    () => files.value.find((f) => f.guid === highlighted.value) ?? null,
  )

  /** Ace files (modes, extensions) compiled into the application. */
  const aceFiles = computed(() => (config.value.ace_includes ?? '').split('|').filter((x) => x))
  const aceModes = computed(() => {
    if (!config.value.ace_includes) return []
    return [
      'text',
      ...aceFiles.value.filter((f) => f.startsWith('mode-')).map((f) => f.substring(5)),
    ]
  })

  const decorateContext = (): DecorateContext => ({
    config: config.value,
    api: api.value.url,
    currentDir: currentDir.value,
    isMobile,
  })

  // ---------------------------------------------------------------------------
  // helpers: logging, notifications, tasks, dialogs
  // ---------------------------------------------------------------------------
  function log(...args: unknown[]) {
    if (config.value.debug) console.log('IFM (debug):', ...args)
  }

  function notify(message: string, type: MessageType = 'i') {
    notifications.value.push({ id: generateGuid(), message, type })
  }

  function dismiss(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function addTask(name: string, type: TaskType = 'info'): string {
    const id = generateGuid()
    tasks.value.unshift({ id, name, type, progress: 100 })
    return id
  }

  function updateTask(id: string, progress: number) {
    const task = tasks.value.find((x) => x.id === id)
    if (task) task.progress = progress
  }

  function removeTask(id: string) {
    tasks.value = tasks.value.filter((x) => x.id !== id)
  }

  async function withTask<T>(name: string, fn: (id: string) => Promise<T>): Promise<T> {
    const id = addTask(name)
    try {
      return await fn(id)
    } finally {
      removeTask(id)
    }
  }

  function openDialog<N extends DialogName>(name: N, props: DialogProps<N>) {
    contextMenu.value = null
    dialogKey.value++
    dialog.value = { name, props } as DialogState
  }

  function closeDialog() {
    dialog.value = null
  }

  /**
   * Runs a state-changing API call and reports the outcome. `success` is the
   * message shown on success; `null` shows the message sent by the server.
   */
  async function runAction(
    apiName: string,
    params: Params,
    success: string | null,
    options: { refreshOnError?: boolean } = {},
  ): Promise<boolean> {
    try {
      const data = await api.value.post<ApiStatus>(apiName, { dir: currentDir.value, ...params })
      const ok = data.status === 'OK'
      if (ok) notify(success ?? data.message ?? '', 's')
      else notify(data.message ?? t('general_error'), 'e')
      if (ok || options.refreshOnError) void refreshFileTable()
      return ok
    } catch {
      notify(t('general_error'), 'e')
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // initialization & authentication
  // ---------------------------------------------------------------------------
  function setApiUrl(url: string) {
    api.value = markRaw(new ApiClient(url))
  }

  async function init() {
    try {
      config.value = await api.value.post<IfmConfig>('getConfig')
    } catch {
      initError.value = t('load_config_error')
      status.value = 'error'
      return
    }
    // send the CSRF token with every POST request
    if (config.value.csrf_token) api.value.csrfToken = config.value.csrf_token
    log('configuration loaded')

    try {
      i18n.value = await api.value.post<I18n>('getI18N')
    } catch {
      initError.value = t('load_text_error')
      status.value = 'error'
      return
    }
    log('I18N loaded')

    try {
      const auth = await api.value.post<ApiStatus>('checkAuth')
      if (auth.status === 'ERROR') status.value = 'login'
      else await start()
    } catch {
      initError.value = t('general_error')
      status.value = 'error'
    }
  }

  /** Tries to log in; resolves to an error message, or `null` on success. */
  async function login(username: string, password: string): Promise<string | null> {
    try {
      const data = await api.value.post<ApiStatus>('checkAuth', {
        inputLogin: username,
        inputPassword: password,
      })
      if (data.status === 'ERROR') return data.message ?? t('login_failed')
    } catch {
      return 'Authentication failed'
    }
    await start()
    return null
  }

  /** Shows the application and loads the initial directory (from the URL hash). */
  async function start() {
    status.value = 'ready'
    if (window.location.hash)
      await changeDirectory(decodeURIComponent(window.location.hash.substring(1)))
    else await refreshFileTable()
  }

  // ---------------------------------------------------------------------------
  // file table
  // ---------------------------------------------------------------------------
  async function refreshFileTable() {
    await withTask(t('refresh'), async () => {
      try {
        const data = await api.value.post<RawFileItem[] | ApiStatus>('getFiles', {
          dir: currentDir.value,
        })
        if (!Array.isArray(data)) {
          if (data.status === 'ERROR') notify(data.message ?? t('general_error'), 'e')
          else notify(t('invalid_data'), 'e')
          return
        }
        const ctx = decorateContext()
        files.value = data.map((item) => decorateItem(item, ctx))
        selected.value = []
        highlighted.value = null
        contextMenu.value = null
      } catch {
        notify(t('general_error'), 'e')
      }
    })
  }

  async function changeDirectory(
    newdir: string,
    options: { absolute?: boolean; pushState?: boolean } = {},
  ) {
    const { absolute = false, pushState = true } = options
    const dir = absolute ? newdir : pathCombine(currentDir.value, newdir)
    try {
      const data = await api.value.post<{ realpath: string }>('getRealpath', { dir })
      currentDir.value = data.realpath
      if (pushState)
        history.pushState(
          { dir: currentDir.value },
          currentDir.value,
          '#' + encodeURIComponent(currentDir.value),
        )
      await refreshFileTable()
    } catch {
      notify(t('general_error'), 'e')
    }
  }

  function toggleSelection(guid: string) {
    const item = files.value.find((f) => f.guid === guid)
    if (!item || item.isParent) return
    if (selected.value.includes(guid)) selected.value = selected.value.filter((g) => g !== guid)
    else selected.value = [...selected.value, guid]
  }

  function isSelected(guid: string): boolean {
    return selected.value.includes(guid)
  }

  /** Moves the keyboard highlight to the next/previous visible row. */
  function highlightItem(direction: 'next' | 'prev', focusedGuid?: string | null) {
    const rows = visibleGuids.value
    if (rows.length === 0) return
    const current = highlighted.value ?? null
    if (current === null || !rows.includes(current)) {
      highlighted.value = focusedGuid && rows.includes(focusedGuid) ? focusedGuid : rows[0]!
      return
    }
    const idx = rows.indexOf(current) + (direction === 'next' ? 1 : -1)
    if (idx >= 0 && idx < rows.length) highlighted.value = rows[idx]!
  }

  // ---------------------------------------------------------------------------
  // file operations
  // ---------------------------------------------------------------------------
  async function editFile(filename: string) {
    try {
      const data = await api.value.post<
        ApiStatus & { data?: { filename: string; content: string | null } }
      >('getContent', { dir: currentDir.value, filename })
      if (data.status === 'OK' && data.data && data.data.content != null)
        openDialog('file', {
          filename: data.data.filename,
          content: data.data.content,
          isNew: false,
        })
      else if (data.status === 'OK') notify(t('file_load_error'), 'e')
      else notify(data.message ?? t('general_error'), 'e')
    } catch {
      notify(t('file_display_error'), 'e')
    }
  }

  function newFile() {
    openDialog('file', { filename: 'newfile.txt', content: '', isNew: true })
  }

  function saveFile(filename: string, content: string) {
    return runAction('saveFile', { filename, content }, t('file_save_success'))
  }

  function createDir(dirname: string) {
    return runAction('createDir', { dirname }, t('folder_create_success'))
  }

  function deleteFiles(items: FileItem[]) {
    return runAction('delete', { filenames: items.map((e) => e.name) }, t('file_delete_success'))
  }

  function renameFile(filename: string, newname: string) {
    return runAction('rename', { filename, newname }, t('file_rename_success'))
  }

  function changePermissions(filename: string, chmod: string) {
    return runAction('changePermissions', { filename, chmod }, t('permission_change_success'))
  }

  function copyMove(sources: FileItem[] | string[], destination: string, action: 'copy' | 'move') {
    const names = sources.map((s) => (typeof s === 'string' ? s : s.name))
    const what = names.length > 1 ? String(names.length) : names[0]
    const taskName = `${t(action)} ${what} ${t('file_copy_to')} ${destination}`
    return withTask(taskName, () =>
      runAction('copyMove', { action, filenames: names, destination }, null, {
        refreshOnError: true,
      }),
    )
  }

  function extractFile(filename: string, targetdir: string) {
    return withTask(`extract ${filename}`, () =>
      runAction('extract', { filename, targetdir }, null),
    )
  }

  async function uploadFile(file: File, newfilename?: string) {
    const dir = currentDir.value
    await withTask(`Upload ${file.name}`, async (id) => {
      const fields: Record<string, string | Blob> = { dir, file }
      if (newfilename) fields.newfilename = newfilename
      try {
        const data = await api.value.upload(fields, (p) => updateTask(id, p))
        log(`Uploading ${file.name} done.`)
        if (data.status === 'OK') {
          notify(t('file_upload_success'), 's')
          if (data.cd === currentDir.value) void refreshFileTable()
        } else notify(data.message ?? t('general_error'), 'e')
      } catch {
        notify(t('general_error'), 'e')
      }
    })
  }

  /**
   * Uploads files, asking for confirmation first when existing files would be
   * overwritten (and `confirmoverwrite` is enabled).
   */
  function uploadFiles(fileList: File[], newfilename?: string, confirmed = false) {
    if (!confirmed && config.value.confirmoverwrite) {
      let existing: string[]
      if (fileList.length > 1)
        existing = fileList.map((x) => x.name).filter((n) => fileNames.value.includes(n))
      else {
        const name = newfilename || fileList[0]!.name
        existing = fileNames.value.includes(name) ? [name] : []
      }
      if (existing.length > 0) {
        openDialog('uploadConfirmOverwrite', { files: fileList, existing, newfilename })
        return
      }
    }
    if (fileList.length === 1) void uploadFile(fileList[0]!, newfilename)
    else fileList.forEach((f) => void uploadFile(f))
  }

  function remoteUpload(url: string, filename: string, method: string) {
    return withTask(`${t('upload_remote')} ${filename}`, () =>
      runAction('remoteUpload', { filename, method, url }, t('file_upload_success')),
    )
  }

  /** Creates an archive; returns `false` (without request) if the name has no valid format. */
  function createArchive(items: FileItem[], archivename: string): boolean {
    const format = archiveFormat(archivename)
    if (!format) {
      notify(t('invalid_archive_format'), 'e')
      return false
    }
    void withTask(`${t('create_archive')} ${archivename}`, () =>
      runAction(
        'createArchive',
        { archivename, filenames: items.map((e) => e.name), format },
        null,
      ),
    )
    return true
  }

  async function searchItems(pattern: string): Promise<boolean> {
    lastSearch.value = pattern
    try {
      const data = await api.value.post<RawFileItem[] | ApiStatus>('searchItems', {
        dir: currentDir.value,
        pattern,
      })
      if (!Array.isArray(data)) {
        notify(data.message ?? t('general_error'), 'e')
        return false
      }
      searchResults.value = data.map(decorateSearchResult)
      searchDir.value = currentDir.value
      return true
    } catch {
      notify(t('general_error'), 'e')
      return false
    }
  }

  async function getFolders(dir?: string): Promise<FolderNode[]> {
    return api.value.post<FolderNode[]>('getFolders', dir === undefined ? {} : { dir })
  }

  return {
    // state
    api,
    status,
    initError,
    config,
    i18n,
    currentDir,
    files,
    visibleGuids,
    selected,
    highlighted,
    tasks,
    notifications,
    dialog,
    dialogKey,
    contextMenu,
    lastSearch,
    searchResults,
    searchDir,
    isMobile,
    // getters
    t,
    fileNames,
    selectedItems,
    highlightedItem,
    aceFiles,
    aceModes,
    decorateContext,
    // actions
    log,
    notify,
    dismiss,
    addTask,
    updateTask,
    removeTask,
    openDialog,
    closeDialog,
    setApiUrl,
    init,
    login,
    start,
    refreshFileTable,
    changeDirectory,
    toggleSelection,
    isSelected,
    highlightItem,
    editFile,
    newFile,
    saveFile,
    createDir,
    deleteFiles,
    renameFile,
    changePermissions,
    copyMove,
    extractFile,
    uploadFile,
    uploadFiles,
    remoteUpload,
    createArchive,
    searchItems,
    getFolders,
  }
})

export type IfmStore = ReturnType<typeof useIfmStore>
