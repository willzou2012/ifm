import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises, rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import FileTable from '../FileTable.vue'
import type { IfmConfig } from '@/types'

beforeEach(() => localStorage.clear())
afterEach(() => {
  document.body.innerHTML = ''
})

const files = () => [
  rawDir('..'),
  rawDir('docs'),
  rawFile('b.txt', { size_raw: 50 }),
  rawFile('a.png', { icon: 'icon fa fa-file-image-o', mime_type: 'image/png', size_raw: 10 }),
  rawFile('c.zip', { ext: 'zip', mime_type: 'application/zip', size_raw: 99 }),
]

function setup(config: Partial<IfmConfig> = {}, list = files()) {
  const store = setupStore({ config, files: list })
  const wrapper = mount(FileTable, { attachTo: document.body })
  return { store, wrapper }
}

const names = (wrapper: ReturnType<typeof setup>['wrapper']) =>
  wrapper.findAll('tbody tr').map((r) => r.attributes('data-filename'))

function dataTransfer(types: string[] = [], data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data }
  return {
    types,
    effectAllowed: '',
    setData: vi.fn((k: string, v: string) => (store[k] = v)),
    getData: (k: string) => store[k] ?? '',
    setDragImage: vi.fn(),
  }
}

describe('FileTable', () => {
  it('renders all configured columns', () => {
    const { wrapper } = setup()
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Filename',
      '',
      'Last Modified',
      'Size',
      'Permissions',
      'Owner',
      'Group',
      '',
    ])
    expect(names(wrapper)).toEqual(['..', 'docs', 'b.txt', 'a.png', 'c.zip'])
    const row = wrapper.find('tr[data-filename="b.txt"]')
    expect(row.find('a.ifmitem').attributes('href')).toBe('b.txt')
    expect(row.find('a[name="start_download"]').exists()).toBe(true)
    expect(row.findAll('.td-buttons a').map((a) => a.attributes('name'))).toEqual([
      'do-edit',
      'do-copymove',
      'do-rename',
      'do-delete',
    ])
    expect(wrapper.find('tr[data-filename=".."] a.ifmitem').text()).toContain('[ up ]')
  })

  it('hides disabled columns', () => {
    const { wrapper } = setup({
      download: 0,
      showlastmodified: 0,
      showfilesize: 0,
      showpermissions: 0,
      showowner: 0,
      showgroup: 0,
    })
    expect(wrapper.findAll('thead th')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')[0]!.findAll('td')).toHaveLength(2)
  })

  it('sorts by clicking the column headers', async () => {
    const { wrapper } = setup()
    const sizeHeader = wrapper.find('th.th-size')
    expect(sizeHeader.attributes('aria-sort')).toBe('none')
    await sizeHeader.trigger('click')
    expect(names(wrapper)).toEqual(['..', 'docs', 'a.png', 'b.txt', 'c.zip'])
    expect(sizeHeader.attributes('aria-sort')).toBe('ascending')
    expect(sizeHeader.find('.sort-icon').classes()).toContain('fa-sort-asc')
    await sizeHeader.trigger('click')
    expect(names(wrapper)).toEqual(['..', 'c.zip', 'b.txt', 'a.png', 'docs'])
    expect(sizeHeader.find('.sort-icon').classes()).toContain('fa-sort-desc')
    expect(wrapper.find('th.th-permissions').attributes('aria-sort')).toBeUndefined()
    await wrapper.find('th.th-permissions').trigger('click')
    expect(names(wrapper)).toEqual(['..', 'c.zip', 'b.txt', 'a.png', 'docs'])
  })

  it('filters rows and tells the store which rows are visible', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('input[name="filter"]').setValue('zip')
    expect(names(wrapper)).toEqual(['..', 'c.zip'])
    expect(store.visibleGuids).toHaveLength(2)
  })

  it('pages through many files', async () => {
    const many = Array.from({ length: 25 }, (_, i) => rawFile(`f${String(i).padStart(2, '0')}`))
    const { wrapper } = setup({ paging: 1, pageLength: 10 }, many)
    expect(names(wrapper)).toHaveLength(10)
    const pageLinks = () => wrapper.findAll('.pagination .page-link')
    expect(pageLinks().map((l) => l.text())).toEqual(['Previous', '1', '2', '3', 'Next'])
    await pageLinks()[0]!.trigger('click')
    expect(names(wrapper)[0]).toBe('f00')
    await pageLinks()[4]!.trigger('click')
    expect(names(wrapper)[0]).toBe('f10')
    await pageLinks()[3]!.trigger('click')
    expect(names(wrapper)).toEqual(['f20', 'f21', 'f22', 'f23', 'f24'])
    await pageLinks()[4]!.trigger('click')
    expect(names(wrapper)[0]).toBe('f20')
    await pageLinks()[0]!.trigger('click')
    expect(names(wrapper)[0]).toBe('f10')

    await wrapper.find('select[name="pageLength"]').setValue('25')
    expect(names(wrapper)).toHaveLength(25)
    expect(wrapper.find('.pagination').exists()).toBe(false)
  })

  it('clamps the page when the file list shrinks', async () => {
    const many = Array.from({ length: 25 }, (_, i) => rawFile(`f${i}`))
    const { store, wrapper } = setup({ paging: 1, pageLength: 10 }, many)
    await wrapper.findAll('.pagination .page-link')[3]!.trigger('click')
    store.files = store.files.slice(0, 12)
    await flushPromises()
    expect(names(wrapper)).toEqual(['f10', 'f11'])
  })

  it('changes into directories and lets files open normally', async () => {
    const { store, wrapper } = setup()
    const cd = vi.spyOn(store, 'changeDirectory').mockResolvedValue()
    await wrapper.find('tr[data-filename="docs"] a.ifmitem').trigger('click')
    expect(cd).toHaveBeenCalledWith('docs')
    // record whether the component prevented the navigation, then stop jsdom from navigating
    let prevented: boolean | undefined
    document.addEventListener(
      'click',
      (e) => {
        prevented = e.defaultPrevented
        e.preventDefault()
      },
      { once: true },
    )
    await wrapper.find('tr[data-filename="b.txt"] a.ifmitem').trigger('click')
    expect(prevented).toBe(false)
  })

  it('selects rows with ctrl+click on a cell', async () => {
    const { store, wrapper } = setup()
    const row = wrapper.find('tr[data-filename="b.txt"]')
    await row.find('td.td-size').trigger('click')
    expect(store.selected).toEqual([])
    await row.find('td.td-size').trigger('click', { ctrlKey: true })
    expect(row.classes()).toContain('selectedItem')
    // ctrl+click on the link itself (opens a new tab) does not select
    document.addEventListener('click', (e) => e.preventDefault(), { once: true })
    await row.find('a.ifmitem').trigger('click', { ctrlKey: true })
    expect(store.selected).toHaveLength(1)
  })

  it('runs the row buttons', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('tr[data-filename="b.txt"] a[name="do-rename"]').trigger('click')
    expect(store.dialog).toEqual({ name: 'rename', props: { filename: 'b.txt' } })
    store.closeDialog()
    await wrapper.find('tr[data-filename="c.zip"] a[name="do-extract"]').trigger('keypress', {
      key: 'Enter',
    })
    expect(store.dialog).toEqual({ name: 'extract', props: { filename: 'c.zip' } })
  })

  it('changes permissions with Enter', async () => {
    const { store, wrapper } = setup()
    const chmod = vi.spyOn(store, 'changePermissions').mockResolvedValue(true)
    const input = wrapper.find('tr[data-filename="b.txt"] input[name="newpermissions"]')
    await input.setValue('rwxr-xr-x')
    await input.trigger('keypress', { key: 'Enter' })
    expect(chmod).toHaveBeenCalledWith('b.txt', 'rwxr-xr-x')
  })

  it('keeps permissions read-only without chmod permission', async () => {
    const { store, wrapper } = setup({ chmod: 0 })
    const chmod = vi.spyOn(store, 'changePermissions')
    const input = wrapper.find('tr[data-filename="b.txt"] input[name="newpermissions"]')
    expect(input.attributes('readonly')).toBeDefined()
    await input.trigger('keypress', { key: 'Enter' })
    expect(chmod).not.toHaveBeenCalled()
  })

  it('opens the context menu', async () => {
    const { store, wrapper } = setup()
    await wrapper
      .find('tr[data-filename="b.txt"]')
      .trigger('contextmenu', { clientX: 5, clientY: 6 })
    expect(store.contextMenu).toEqual({ x: 5, y: 6, guid: store.files[2]!.guid })
  })

  it('keeps the browser context menu if disabled', async () => {
    const { store, wrapper } = setup({ contextmenu: 0 })
    await wrapper.find('tr[data-filename="b.txt"]').trigger('contextmenu')
    expect(store.contextMenu).toBeNull()
  })

  it('previews images on hover', async () => {
    const { wrapper } = setup()
    const link = wrapper.find('tr[data-filename="a.png"] a.ifmitem')
    await link.trigger('mouseenter')
    expect(wrapper.find('.ifm-image-preview img').attributes('src')).toBe('a.png')
    await link.trigger('mouseleave')
    expect(wrapper.find('.ifm-image-preview').exists()).toBe(false)
    await wrapper.find('tr[data-filename="b.txt"] a.ifmitem').trigger('mouseenter')
    expect(wrapper.find('.ifm-image-preview').exists()).toBe(false)
  })

  it('focuses and scrolls to the highlighted row', async () => {
    const { store, wrapper } = setup()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    store.highlighted = store.files[2]!.guid
    await flushPromises()
    expect(document.activeElement?.id).toBe(store.files[2]!.guid)
    expect(wrapper.find('tr[data-filename="b.txt"]').classes()).toContain('highlightedItem')
    // jsdom reports zero sized rectangles at the top of the page
    expect(scroll).toHaveBeenCalled()

    store.highlighted = null
    await flushPromises()
    store.config.inline = true
    store.highlighted = 'missing'
    await flushPromises()
  })

  describe('drag and drop', () => {
    it('moves dragged items onto directories', async () => {
      const { store, wrapper } = setup()
      const move = vi.spyOn(store, 'copyMove').mockResolvedValue(true)
      const dt = dataTransfer()
      await wrapper.find('tr[data-filename="b.txt"]').trigger('dragstart', { dataTransfer: dt })
      expect(JSON.parse(dt.getData('text/plain'))).toEqual(['b.txt'])
      expect(dt.setDragImage).toHaveBeenCalled()

      const target = wrapper.find('tr[data-filename="docs"]')
      await target.trigger('dragenter', { dataTransfer: dt })
      expect(target.classes()).toContain('highlightedItem')
      await target.trigger('dragleave', {
        dataTransfer: dt,
        relatedTarget: target.find('td').element,
      })
      expect(target.classes()).toContain('highlightedItem')
      await target.trigger('dragleave', { dataTransfer: dt, relatedTarget: null })
      expect(target.classes()).not.toContain('highlightedItem')

      const over = new Event('dragover', { cancelable: true }) as DragEvent
      Object.defineProperty(over, 'dataTransfer', { value: dt })
      target.element.dispatchEvent(over)
      expect(over.defaultPrevented).toBe(true)

      await target.trigger('drop', { dataTransfer: dt })
      expect(move).toHaveBeenCalledWith(['b.txt'], 'docs', 'move')
    })

    it('drags the whole selection', async () => {
      const { store, wrapper } = setup()
      store.selected = [store.files[2]!.guid, store.files[4]!.guid]
      const dt = dataTransfer()
      await wrapper.find('tr[data-filename="b.txt"]').trigger('dragstart', { dataTransfer: dt })
      expect(JSON.parse(dt.getData('text/plain'))).toEqual(['b.txt', 'c.zip'])
      // dragging an unselected row only drags this row
      await wrapper.find('tr[data-filename="a.png"]').trigger('dragstart', { dataTransfer: dt })
      expect(JSON.parse(dt.getData('text/plain'))).toEqual(['a.png'])
    })

    it('refuses invalid drops', async () => {
      const { store, wrapper } = setup()
      const move = vi.spyOn(store, 'copyMove').mockResolvedValue(true)
      const docs = wrapper.find('tr[data-filename="docs"]')
      // files from the desktop are handled by the upload overlay
      await docs.trigger('drop', { dataTransfer: dataTransfer(['Files']) })
      await docs.trigger('dragenter', { dataTransfer: dataTransfer(['Files']) })
      expect(docs.classes()).not.toContain('highlightedItem')
      // files are no drop targets
      await wrapper
        .find('tr[data-filename="b.txt"]')
        .trigger('drop', { dataTransfer: dataTransfer() })
      // garbage and empty payloads
      await docs.trigger('drop', { dataTransfer: dataTransfer([], { 'text/plain': '{nope' }) })
      await docs.trigger('drop', { dataTransfer: dataTransfer([], { 'text/plain': '[]' }) })
      expect(move).not.toHaveBeenCalled()
      // dropping a directory onto itself
      await docs.trigger('drop', { dataTransfer: dataTransfer([], { 'text/plain': '["docs"]' }) })
      expect(store.notifications[0]?.message).toBe('Source and destination are equal.')
    })

    it('does nothing without copymove permission', async () => {
      const { wrapper } = setup({ copymove: 0 })
      const row = wrapper.find('tr[data-filename="b.txt"]')
      expect(row.attributes('draggable')).toBe('false')
      const dt = dataTransfer()
      await row.trigger('dragstart', { dataTransfer: dt })
      expect(dt.setData).not.toHaveBeenCalled()
    })
  })
})
