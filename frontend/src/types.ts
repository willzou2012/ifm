/**
 * Shared types of the IFM frontend.
 */

/** Feature flags are delivered by PHP as 0/1 (or strings when set via env). */
export type Flag = number | boolean | string | undefined

/** Client-side configuration as returned by the `getConfig` API. */
export interface IfmConfig {
  auth?: Flag
  ajaxrequest?: Flag
  chmod?: Flag
  copymove?: Flag
  createdir?: Flag
  createfile?: Flag
  edit?: Flag
  delete?: Flag
  download?: Flag
  extract?: Flag
  upload?: Flag
  remoteupload?: Flag
  rename?: Flag
  zipnload?: Flag
  createarchive?: Flag
  search?: Flag
  paging?: Flag
  pageLength?: number | string
  showlastmodified?: Flag
  showfilesize?: Flag
  showowner?: Flag
  showgroup?: Flag
  showpermissions?: Flag
  showhtdocs?: Flag
  showhiddenfiles?: Flag
  showpath?: Flag
  contextmenu?: Flag
  disable_mime_detection?: Flag
  showrefresh?: Flag
  forceproxy?: Flag
  confirmoverwrite?: Flag
  customDateFormat?: string | false
  root_public_url?: string
  inline?: boolean
  isDocroot?: boolean
  csrf_token?: string
  ace_includes?: string
  debug?: Flag
  language?: string
  [key: string]: unknown
}

export type I18n = Record<string, string>

/** Generic JSON answer of state-changing API calls. */
export interface ApiStatus {
  status: 'OK' | 'ERROR'
  message?: string
  [key: string]: unknown
}

/** A file table entry as delivered by the `getFiles` / `searchItems` APIs. */
export interface RawFileItem {
  name: string
  type: 'file' | 'dir'
  icon: string
  ext?: string
  mime_type?: string | false
  lastmodified?: number
  size?: string
  size_raw?: number
  fileperms?: string
  filepermmode?: 'short' | 'long'
  owner?: string | false
  group?: string | false
}

export type FileAction = 'edit' | 'extract' | 'copymove' | 'rename' | 'delete'

export interface ItemButton {
  action: FileAction
  icon: string
  title: string
}

/** A file table entry enriched with everything the UI needs to render it. */
export interface FileItem extends RawFileItem {
  guid: string
  linkname: string
  /** `true` for the parent directory entry, which always sticks to the top. */
  isParent: boolean
  lastmodified_hr: string
  link: string
  download: {
    name: string
    action?: 'download' | 'zipnload'
    icon?: string
    link: string
  }
  /** Primary action of the item (shown in the context menu / bound to `e`). */
  eaction?: 'edit' | 'extract'
  buttons: ItemButton[]
  draggable: boolean
  imagePreview: boolean
}

export interface SearchResult extends RawFileItem {
  guid: string
  folder: string
  linkname: string
}

/** Node of the folder tree used by the copy/move dialog (`getFolders` API). */
export interface FolderNode {
  text: string
  lazyLoad?: boolean
  dataAttr: { path: string }
}

export type TaskType = 'info' | 'warning' | 'danger' | 'success'

export interface Task {
  id: string
  name: string
  type: TaskType
  progress: number
}

export type MessageType = 'e' | 's' | 'i'

export interface Notification {
  id: string
  message: string
  type: MessageType
}
