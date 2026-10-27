<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useIfmStore } from '@/stores/ifm'
import { useFileActions } from '@/composables/useFileActions'
import {
  filterItems,
  pageCount,
  paginate,
  sortItems,
  useTableState,
  type SortKey,
} from '@/composables/useTableState'
import type { FileItem } from '@/types'
import { imagePreviewUrl } from '@/utils/files'

const store = useIfmStore()
const { runItemAction, contextMenuEnabled } = useFileActions()

const pageLength = Number(store.config.pageLength) || 50
const { state, toggleSort } = useTableState(`ifm.filetable.${window.location.pathname}`, {
  pageLength,
})
const pageLengths = computed(() =>
  [...new Set([10, 25, 50, 100, pageLength])].sort((a, b) => a - b),
)

const c = computed(() => store.config)
const paging = computed(() => !!c.value.paging)

const filtered = computed(() =>
  sortItems(filterItems(store.files, state.filter), state.sortKey, state.sortDir),
)
const pages = computed(() =>
  paging.value ? pageCount(filtered.value.length, state.pageLength) : 1,
)
const rows = computed(() =>
  paging.value ? paginate(filtered.value, state.page, state.pageLength) : filtered.value,
)

// the keyboard navigation works on the rows in their displayed order
watch(rows, (r) => (store.visibleGuids = r.map((i) => i.guid)), { immediate: true })
watch(
  () => [state.filter, state.pageLength, store.currentDir],
  () => (state.page = 0),
)
watch(pages, (n) => {
  if (state.page >= n) state.page = n - 1
})

interface Column {
  key: string
  label: string
  sort?: SortKey
  class?: string
}

const columns = computed<Column[]>(() => {
  const cols: Column[] = [
    { key: 'filename', label: store.t('filename'), sort: 'name', class: 'th-filename' },
  ]
  if (c.value.download) cols.push({ key: 'download', label: '', class: 'th-download' })
  if (c.value.showlastmodified)
    cols.push({
      key: 'lastmod',
      label: store.t('last_modified'),
      sort: 'lastmodified',
      class: 'th-lastmod d-none d-lg-table-cell',
    })
  if (c.value.showfilesize)
    cols.push({
      key: 'size',
      label: store.t('size'),
      sort: 'size',
      class: 'th-size d-none d-md-table-cell',
    })
  if (c.value.showpermissions)
    cols.push({
      key: 'permissions',
      label: store.t('permissions'),
      class: 'th-permissions d-none d-md-table-cell',
    })
  if (c.value.showowner)
    cols.push({
      key: 'owner',
      label: store.t('owner'),
      sort: 'owner',
      class: 'th-owner d-none d-lg-table-cell',
    })
  if (c.value.showgroup)
    cols.push({
      key: 'group',
      label: store.t('group'),
      sort: 'group',
      class: 'th-group d-none d-xl-table-cell',
    })
  cols.push({ key: 'buttons', label: '', class: 'th-buttons buttons' })
  return cols
})

function sortIcon(col: Column): string {
  if (state.sortKey !== col.sort) return 'fa-sort text-muted'
  return state.sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc'
}

function ariaSort(col: Column): 'ascending' | 'descending' | 'none' | undefined {
  if (!col.sort) return undefined
  if (state.sortKey !== col.sort) return 'none'
  return state.sortDir === 'asc' ? 'ascending' : 'descending'
}

// --- interaction --------------------------------------------------------------

function onRowClick(e: MouseEvent, item: FileItem) {
  if (e.ctrlKey && (e.target as HTMLElement).tagName === 'TD') store.toggleSelection(item.guid)
}

function onItemClick(e: MouseEvent, item: FileItem) {
  if (item.type === 'dir') {
    e.preventDefault()
    void store.changeDirectory(item.name)
  }
}

function onContextMenu(e: MouseEvent, item: FileItem) {
  if (!contextMenuEnabled()) return
  e.preventDefault()
  store.contextMenu = { x: e.clientX, y: e.clientY, guid: item.guid }
}

function onPermissionsEnter(e: KeyboardEvent, item: FileItem) {
  if (c.value.chmod) void store.changePermissions(item.name, (e.target as HTMLInputElement).value)
}

// image preview on hover
const previewGuid = ref<string | null>(null)
const previewSrc = (item: FileItem) => imagePreviewUrl(item, store.decorateContext())

// --- drag & drop of items onto directories (move) ---------------------------------

const dropTarget = ref<string | null>(null)
const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

function onDragStart(e: DragEvent, item: FileItem) {
  if (!c.value.copymove || !e.dataTransfer) return
  const names =
    store.isSelected(item.guid) && store.selectedItems.length > 0
      ? store.selectedItems.map((i) => i.name)
      : [item.name]
  e.dataTransfer.setData('text/plain', JSON.stringify(names))
  e.dataTransfer.effectAllowed = 'move'
  const dragImage = document.createElement('div')
  dragImage.style.display = 'inline'
  dragImage.style.padding = '10px'
  dragImage.innerHTML = '<span class="icon fa fa-folder-open-o"></span> '
  dragImage.append(`${store.t('move')} ${names.length > 1 ? names.length : names[0]}`)
  document.body.appendChild(dragImage)
  e.dataTransfer.setDragImage(dragImage, 0, 0)
  setTimeout(() => dragImage.remove())
}

function acceptsDrop(e: DragEvent, item: FileItem): boolean {
  return !!c.value.copymove && item.type === 'dir' && !isFileDrag(e)
}

function onDragOver(e: DragEvent, item: FileItem) {
  if (acceptsDrop(e, item)) e.preventDefault()
}

function onDragEnter(e: DragEvent, item: FileItem) {
  if (acceptsDrop(e, item)) dropTarget.value = item.guid
}

function onDragLeave(e: DragEvent, item: FileItem) {
  const row = e.currentTarget as HTMLElement
  if (dropTarget.value === item.guid && !row.contains(e.relatedTarget as Node | null))
    dropTarget.value = null
}

function onDrop(e: DragEvent, item: FileItem) {
  if (!acceptsDrop(e, item)) return
  e.preventDefault()
  e.stopPropagation()
  dropTarget.value = null
  let names: unknown
  try {
    names = JSON.parse(e.dataTransfer?.getData('text/plain') ?? '')
  } catch (err) {
    store.log(err)
    return
  }
  if (!Array.isArray(names) || names.length === 0) return
  if (names.includes(item.name)) store.notify('Source and destination are equal.')
  else void store.copyMove(names as string[], item.name, 'move')
}

// --- keyboard highlight ---------------------------------------------------------

watch(
  () => store.highlighted,
  async (guid) => {
    if (!guid) return
    await nextTick()
    const el = document.getElementById(guid)
    if (!el) return
    el.focus({ preventScroll: true })
    const rect = el.getBoundingClientRect()
    const navbarHeight = c.value.inline ? 0 : 80
    if (rect.top < navbarHeight || rect.bottom > window.innerHeight)
      el.closest('tr')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
)
</script>

<template>
  <div class="ifm-filetable">
    <div class="row ifm-filetable-controls">
      <div class="col-sm-6">
        <label v-if="paging" class="form-inline">
          Show
          <select
            v-model.number="state.pageLength"
            class="custom-select custom-select-sm mx-1"
            name="pageLength"
          >
            <option v-for="n in pageLengths" :key="n" :value="n">{{ n }}</option>
          </select>
          entries
        </label>
      </div>
      <div class="col-sm-6 text-sm-right">
        <label class="form-inline justify-content-sm-end">
          {{ store.t('filter') }}
          <input
            v-model="state.filter"
            type="search"
            class="form-control form-control-sm ml-2"
            name="filter"
            aria-controls="filetable"
          />
        </label>
      </div>
    </div>
    <table id="filetable" class="table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="[col.class, { sortable: col.sort }]"
            :aria-sort="ariaSort(col)"
            @click="col.sort && toggleSort(col.sort)"
          >
            {{ col.label }}
            <span v-if="col.sort" class="fa fa-fw sort-icon" :class="sortIcon(col)" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in rows"
          :key="item.guid"
          class="clickable-row"
          :class="{
            isDir: item.type === 'dir',
            selectedItem: store.selected.includes(item.guid),
            highlightedItem: store.highlighted === item.guid || dropTarget === item.guid,
          }"
          :draggable="item.draggable && !!c.copymove"
          :data-id="item.guid"
          :data-filename="item.name"
          :data-eaction="item.eaction"
          @click="onRowClick($event, item)"
          @contextmenu="onContextMenu($event, item)"
          @dragstart="onDragStart($event, item)"
          @dragover="onDragOver($event, item)"
          @dragenter="onDragEnter($event, item)"
          @dragleave="onDragLeave($event, item)"
          @drop="onDrop($event, item)"
        >
          <td class="td-filename">
            <a
              :id="item.guid"
              :href="item.link"
              tabindex="0"
              class="ifmitem"
              draggable="false"
              :data-type="item.type"
              :data-name="item.name"
              @click="onItemClick($event, item)"
              @mouseenter="item.imagePreview && (previewGuid = item.guid)"
              @mouseleave="previewGuid = null"
            >
              <span :class="item.icon" />
              {{ item.linkname }}
            </a>
            <div
              v-if="previewGuid === item.guid"
              class="popover bs-popover-bottom ifm-image-preview"
              role="tooltip"
            >
              <div class="arrow" />
              <div class="popover-body">
                <img class="imgpreview" :src="previewSrc(item)" :alt="item.name" />
              </div>
            </div>
          </td>
          <td v-if="c.download" class="td-download">
            <a v-if="item.download.action" :href="item.download.link" name="start_download">
              <span :class="item.download.icon" title="download" />
            </a>
          </td>
          <td v-if="c.showlastmodified" class="td-lastmod d-none d-lg-table-cell">
            {{ item.lastmodified_hr }}
          </td>
          <td v-if="c.showfilesize" class="td-size d-none d-md-table-cell">{{ item.size }}</td>
          <td v-if="c.showpermissions" class="td-permissions d-none d-md-table-cell">
            <input
              type="text"
              size="11"
              name="newpermissions"
              class="form-control"
              :class="item.filepermmode"
              :value="item.fileperms"
              :data-filename="item.name"
              :readonly="!c.chmod"
              @keypress.enter="onPermissionsEnter($event, item)"
            />
          </td>
          <td v-if="c.showowner" class="td-owner d-none d-lg-table-cell">{{ item.owner }}</td>
          <td v-if="c.showgroup" class="td-group d-none d-xl-table-cell">{{ item.group }}</td>
          <td class="td-buttons">
            <a
              v-for="button in item.buttons"
              :key="button.action"
              tabindex="0"
              :name="`do-${button.action}`"
              :data-id="item.guid"
              @click.prevent.stop="runItemAction(button.action, item)"
              @keypress.enter.prevent.stop="runItemAction(button.action, item)"
            >
              <span :class="button.icon" :title="button.title" />
            </a>
          </td>
        </tr>
      </tbody>
    </table>
    <nav v-if="paging && pages > 1" aria-label="pagination">
      <ul class="pagination pagination-sm justify-content-end">
        <li class="page-item" :class="{ disabled: state.page === 0 }">
          <a class="page-link" href="#" @click.prevent="state.page > 0 && state.page--">
            Previous
          </a>
        </li>
        <li v-for="p in pages" :key="p" class="page-item" :class="{ active: state.page === p - 1 }">
          <a class="page-link" href="#" @click.prevent="state.page = p - 1">{{ p }}</a>
        </li>
        <li class="page-item" :class="{ disabled: state.page >= pages - 1 }">
          <a class="page-link" href="#" @click.prevent="state.page < pages - 1 && state.page++">
            Next
          </a>
        </li>
      </ul>
    </nav>
  </div>
</template>
