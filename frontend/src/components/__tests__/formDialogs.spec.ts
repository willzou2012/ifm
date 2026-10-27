import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises, rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import * as client from '@/api/client'
import type { FolderNode } from '@/types'
import AjaxRequestDialog from '../dialogs/AjaxRequestDialog.vue'
import CopyMoveDialog from '../dialogs/CopyMoveDialog.vue'
import RemoteUploadDialog from '../dialogs/RemoteUploadDialog.vue'
import SearchDialog from '../dialogs/SearchDialog.vue'
import UploadDialog from '../dialogs/UploadDialog.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

function store() {
  return setupStore({ files: [rawDir('docs'), rawFile('a.txt'), rawFile('y.zip')] })
}

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change'))
}

describe('UploadDialog', () => {
  it('requires at least one file', async () => {
    const s = store()
    const wrapper = mount(UploadDialog)
    expect(wrapper.find('.custom-file-label').text()).toBe('Upload file(s)')
    await wrapper.find('form').trigger('submit')
    expect(s.notifications[0]).toMatchObject({
      message: 'Please select at least one file.',
      type: 'e',
    })
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('collects files without duplicates and uploads a single file with a new name', async () => {
    const s = store()
    const upload = vi.spyOn(s, 'uploadFiles').mockImplementation(() => {})
    const wrapper = mount(UploadDialog)
    const input = wrapper.find('#fileselect').element as HTMLInputElement
    const a = new File(['a'], 'one.txt', { lastModified: 1 })
    selectFiles(input, [a])
    selectFiles(input, [a])
    await flushPromises()
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(1)
    expect(wrapper.find('.custom-file-label').text()).toBe('one.txt')
    expect(wrapper.find('#filenameContainer').exists()).toBe(true)

    await wrapper.find('#filename').setValue('renamed.txt')
    await wrapper.find('form').trigger('submit')
    expect(upload).toHaveBeenCalledWith([a], 'renamed.txt')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('uploads several files and allows removing them', async () => {
    const s = store()
    const upload = vi.spyOn(s, 'uploadFiles').mockImplementation(() => {})
    const wrapper = mount(UploadDialog)
    const input = wrapper.find('#fileselect').element as HTMLInputElement
    const files = ['1', '2', '3'].map((n) => new File([n], `${n}.txt`))
    selectFiles(input, files)
    await flushPromises()
    expect(wrapper.find('.custom-file-label').text()).toBe('Upload file(s) (3)')
    expect(wrapper.find('#filenameContainer').exists()).toBe(false)
    await wrapper.find('[data-upload-remove="1"]').trigger('click')
    expect(wrapper.findAll('#uploadFileList li').map((l) => l.text())).toEqual(['1.txt', '3.txt'])
    await wrapper.find('form').trigger('submit')
    expect(upload).toHaveBeenCalledWith([files[0], files[2]], undefined)
  })

  it('can be cancelled', async () => {
    store()
    const wrapper = mount(UploadDialog)
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('RemoteUploadDialog', () => {
  it('derives a unique file name from the URL until the name is edited', async () => {
    const s = store()
    const remote = vi.spyOn(s, 'remoteUpload').mockResolvedValue(true)
    const wrapper = mount(RemoteUploadDialog)
    await wrapper.find('#url').setValue('https://example.com/files/y.zip?dl=1')
    expect((wrapper.find('#filename').element as HTMLInputElement).value).toBe('y (1).zip')
    await wrapper.find('#url').setValue('https://example.com/')
    expect((wrapper.find('#filename').element as HTMLInputElement).value).toBe('y (1).zip')

    await wrapper.find('#filename').setValue('custom.zip')
    await wrapper.find('#filename').trigger('keyup')
    await wrapper.find('#url').setValue('https://example.com/other.zip')
    expect((wrapper.find('#filename').element as HTMLInputElement).value).toBe('custom.zip')

    await wrapper.find('#radiofile').setValue(true)
    await wrapper.find('#buttonUpload').trigger('click')
    expect(remote).toHaveBeenCalledWith('https://example.com/other.zip', 'custom.zip', 'file')
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})

describe('AjaxRequestDialog', () => {
  it('sends POST data and shows the response', async () => {
    const s = store()
    s.api.csrfToken = 'tok'
    const request = vi
      .spyOn(client, 'rawRequest')
      .mockResolvedValue({ status: 200, body: 'pong', ok: true })
    const wrapper = mount(AjaxRequestDialog)
    expect(wrapper.find('#ajaxStatusCode').exists()).toBe(false)
    await wrapper.find('#ajaxurl').setValue('/ping')
    await wrapper.find('#ajaxdata').setValue('a=1\nb=2')
    await wrapper.find('#buttonRequest').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/ping', 'POST', 'a=1&b=2', 'tok')
    expect((wrapper.find('#ajaxresponse').element as HTMLTextAreaElement).value).toBe('pong')
    expect(wrapper.find('#ajaxStatusCode').text()).toBe('200')
    expect(wrapper.find('#ajaxStatusCode').classes()).toContain('badge-success')
  })

  it('sends GET requests without data and marks errors', async () => {
    const s = store()
    const log = vi.spyOn(s, 'log')
    const request = vi
      .spyOn(client, 'rawRequest')
      .mockResolvedValue({ status: 404, body: 'missing', ok: false })
    const wrapper = mount(AjaxRequestDialog)
    await wrapper.find('#radioget').setValue(true)
    expect(wrapper.find('#ajaxDataContainer').exists()).toBe(false)
    await wrapper.find('#buttonRequest').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('', 'GET', '', null)
    expect(wrapper.find('#ajaxStatusCode').classes()).toContain('badge-danger')
    expect(log).toHaveBeenCalled()
    await wrapper.find('#buttonClose').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('SearchDialog', () => {
  it('searches and opens the folder of a result', async () => {
    const s = store()
    s.lastSearch = 'old'
    s.currentDir = 'base'
    let finish: () => void = () => {}
    const search = vi.spyOn(s, 'searchItems').mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = () => {
            s.searchDir = 'base'
            s.searchResults = [
              { ...rawFile('./sub/x.txt'), guid: 'G1', folder: './sub', linkname: 'x.txt' },
            ]
            resolve(true)
          }
        }),
    )
    const cd = vi.spyOn(s, 'changeDirectory').mockResolvedValue()
    const wrapper = mount(SearchDialog)
    expect((wrapper.find('#searchPattern').element as HTMLInputElement).value).toBe('old')
    expect(wrapper.findAll('#searchResults tr')).toHaveLength(0)

    await wrapper.find('#searchPattern').setValue('  ')
    await wrapper.find('form').trigger('submit')
    expect(search).not.toHaveBeenCalled()

    await wrapper.find('#searchPattern').setValue('x*')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('.fa-spinner').exists()).toBe(true)
    finish()
    await flushPromises()
    expect(search).toHaveBeenCalledWith('x*')
    const link = wrapper.find('a.searchitem')
    expect(link.text()).toContain('x.txt')
    expect(link.text()).toContain('(./sub)')
    await link.trigger('keypress', { key: 'Enter' })
    expect(cd).toHaveBeenCalledWith('base/./sub', { absolute: true })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows an empty result and closes on errors', async () => {
    const s = store()
    s.searchResults = []
    const search = vi.spyOn(s, 'searchItems').mockResolvedValue(false)
    const wrapper = mount(SearchDialog, { attachTo: document.body })
    expect(wrapper.text()).toContain('No results found.')
    await wrapper.find('#searchPattern').setValue('x')
    await wrapper.find('#buttonSearch').trigger('click')
    await flushPromises()
    expect(search).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('CopyMoveDialog', () => {
  const tree = [
    { text: '/ [root]', dataAttr: { path: '/root' } },
    { text: 'Tom &amp; Jerry', lazyLoad: true, dataAttr: { path: '/root/tj' } },
  ]

  it('loads the tree, expands nodes lazily and copies', async () => {
    const s = store()
    let resolveChildren: (v: FolderNode[]) => void = () => {}
    const getFolders = vi.spyOn(s, 'getFolders').mockImplementation(async (dir?: string) => {
      if (dir === undefined) return tree
      if (dir === '/root/tj') return new Promise<FolderNode[]>((r) => (resolveChildren = r))
      throw new Error('fail')
    })
    const copyMove = vi.spyOn(s, 'copyMove').mockResolvedValue(true)
    const wrapper = mount(CopyMoveDialog, { props: { items: [s.files[1]!] } })
    expect(wrapper.find('.fa-spinner').exists()).toBe(true)
    await flushPromises()

    const nodes = () => wrapper.findAll('#copyMoveTree li')
    expect(nodes().map((n) => n.text())).toEqual(['/ [root]', 'Tom & Jerry'])
    expect(wrapper.find('#copyButton').attributes('disabled')).toBeDefined()

    await nodes()[1]!.find('.expand-icon').trigger('click')
    expect(nodes()[1]!.find('.fa-spinner').exists()).toBe(true)
    resolveChildren([{ text: 'inner', lazyLoad: true, dataAttr: { path: '/root/tj/inner' } }])
    await flushPromises()
    expect(nodes().map((n) => n.text())).toEqual(['/ [root]', 'Tom & Jerry', 'inner'])
    expect(nodes()[1]!.find('.fa-minus-square-o').exists()).toBe(true)

    // failing child loads show no children
    await nodes()[2]!.find('.expand-icon').trigger('click')
    await flushPromises()
    expect(nodes()).toHaveLength(3)

    await nodes()[2]!.trigger('click')
    expect(nodes()[2]!.classes()).toContain('node-selected')

    // collapsing and expanding again does not reload
    await nodes()[1]!.find('.expand-icon').trigger('click')
    expect(nodes()).toHaveLength(2)
    await nodes()[1]!.find('.expand-icon').trigger('click')
    expect(getFolders).toHaveBeenCalledTimes(3)

    await wrapper.find('#copyButton').trigger('click')
    expect(copyMove).toHaveBeenCalledWith([s.files[1]], '/root/tj/inner', 'copy')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('moves to the selected folder', async () => {
    const s = store()
    vi.spyOn(s, 'getFolders').mockResolvedValue(tree)
    const copyMove = vi.spyOn(s, 'copyMove').mockResolvedValue(true)
    const wrapper = mount(CopyMoveDialog, { props: { items: s.files } })
    await flushPromises()
    await wrapper.find('#moveButton').trigger('click')
    expect(copyMove).not.toHaveBeenCalled()
    await wrapper.findAll('#copyMoveTree li')[0]!.trigger('click')
    await wrapper.find('#moveButton').trigger('click')
    expect(copyMove).toHaveBeenCalledWith(s.files, '/root', 'move')
    await wrapper.find('#cancelButton').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('closes with an error if the tree cannot be loaded', async () => {
    const s = store()
    vi.spyOn(s, 'getFolders').mockRejectedValue(new Error('down'))
    const wrapper = mount(CopyMoveDialog, { props: { items: [] } })
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(s.notifications[0]?.message).toBe('Could not fetch folder tree.')
  })
})
