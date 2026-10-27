import { reactive, watch } from 'vue'
import type { FileItem } from '@/types'

export type SortKey = 'name' | 'lastmodified' | 'size' | 'owner' | 'group'
export type SortDir = 'asc' | 'desc'

export interface TableState {
  /** `null` keeps the server order (directories first, natural sort) */
  sortKey: SortKey | null
  sortDir: SortDir
  filter: string
  page: number
  pageLength: number
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function sortValue(item: FileItem, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return item.name
    case 'lastmodified':
      return item.lastmodified ?? 0
    case 'size':
      return item.size_raw ?? 0
    case 'owner':
      return item.owner || ''
    case 'group':
      return item.group || ''
  }
}

/** Sorts the items; the parent directory entry always stays on top. */
export function sortItems(items: FileItem[], key: SortKey | null, dir: SortDir): FileItem[] {
  const parents = items.filter((i) => i.isParent)
  const rest = items.filter((i) => !i.isParent)
  if (key !== null) {
    const factor = dir === 'asc' ? 1 : -1
    rest.sort((a, b) => {
      const va = sortValue(a, key)
      const vb = sortValue(b, key)
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : collator.compare(String(va), String(vb))
      return cmp * factor
    })
  }
  return [...parents, ...rest]
}

function searchableText(item: FileItem): string {
  return [
    item.name,
    item.lastmodified_hr,
    item.size,
    item.fileperms,
    item.owner || '',
    item.group || '',
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Filters the items: every whitespace separated word of the filter has to occur
 * somewhere in the row (case-insensitive). The parent directory entry is kept.
 */
export function filterItems(items: FileItem[], filter: string): FileItem[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  return items.filter((item) => {
    if (item.isParent) return true
    const text = searchableText(item)
    return words.every((w) => text.includes(w))
  })
}

export function pageCount(total: number, pageLength: number): number {
  return Math.max(1, Math.ceil(total / pageLength))
}

export function paginate<T>(items: T[], page: number, pageLength: number): T[] {
  return items.slice(page * pageLength, (page + 1) * pageLength)
}

function load(storageKey: string): Partial<TableState> {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Partial<TableState>) : {}
  } catch {
    return {}
  }
}

/**
 * Reactive sort/filter/paging state of the file table, persisted in the
 * localStorage so it survives reloads.
 */
export function useTableState(storageKey: string, defaults: Partial<TableState> = {}) {
  const state = reactive<TableState>({
    sortKey: null,
    sortDir: 'asc',
    filter: '',
    page: 0,
    pageLength: 50,
    ...defaults,
    ...load(storageKey),
  })

  watch(
    state,
    (s) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(s))
      } catch {
        // storage might be full or disabled; persisting is optional
      }
    },
    { deep: true },
  )

  /** Sorts by a column; clicking the active column again reverses the order. */
  function toggleSort(key: SortKey) {
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
    else {
      state.sortKey = key
      state.sortDir = 'asc'
    }
  }

  return { state, toggleSort }
}
