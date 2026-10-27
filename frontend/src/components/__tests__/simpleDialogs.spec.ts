import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import CreateArchiveDialog from '../dialogs/CreateArchiveDialog.vue'
import CreateDirDialog from '../dialogs/CreateDirDialog.vue'
import DeleteDialog from '../dialogs/DeleteDialog.vue'
import ExtractDialog from '../dialogs/ExtractDialog.vue'
import RenameDialog from '../dialogs/RenameDialog.vue'
import UploadConfirmOverwriteDialog from '../dialogs/UploadConfirmOverwriteDialog.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

function store() {
  return setupStore({ files: [rawDir('docs'), rawFile('a.txt'), rawFile('b.txt')] })
}

describe('CreateDirDialog', () => {
  it('validates the name and creates the directory', async () => {
    const s = store()
    const create = vi.spyOn(s, 'createDir').mockResolvedValue(true)
    const wrapper = mount(CreateDirDialog)
    const input = wrapper.find('#dirname')

    await input.setValue('docs')
    await wrapper.find('form').trigger('submit')
    expect(input.classes()).toContain('is-invalid')
    expect(wrapper.find('#dirnameError').text()).toBe('This name is already taken.')
    expect(create).not.toHaveBeenCalled()

    await input.setValue('new')
    expect(input.classes()).not.toContain('is-invalid')
    await input.setValue('newer')
    await wrapper.find('form').trigger('submit')
    expect(create).toHaveBeenCalledWith('newer')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('can be cancelled', async () => {
    store()
    const wrapper = mount(CreateDirDialog)
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('DeleteDialog', () => {
  it('confirms deleting a single file', async () => {
    const s = store()
    const del = vi.spyOn(s, 'deleteFiles').mockResolvedValue(true)
    const wrapper = mount(DeleteDialog, { props: { items: [s.files[1]!] } })
    expect(wrapper.find('code').text()).toBe('a.txt')
    await wrapper.find('form').trigger('submit')
    expect(del).toHaveBeenCalledWith([s.files[1]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows the number of files and can be cancelled', async () => {
    const s = store()
    const wrapper = mount(DeleteDialog, { props: { items: s.files } })
    expect(wrapper.find('code').text()).toBe('3')
    await wrapper.find('#buttonNo').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('RenameDialog', () => {
  it('renames the file', async () => {
    const s = store()
    const rename = vi.spyOn(s, 'renameFile').mockResolvedValue(true)
    const wrapper = mount(RenameDialog, { props: { filename: 'a.txt' } })
    expect((wrapper.find('#newname').element as HTMLInputElement).value).toBe('a.txt')
    await wrapper.find('#newname').setValue('c.txt')
    await wrapper.find('form').trigger('submit')
    expect(rename).toHaveBeenCalledWith('a.txt', 'c.txt')
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})

describe('CreateArchiveDialog', () => {
  it('stays open for invalid names', async () => {
    const s = store()
    const create = vi.spyOn(s, 'createArchive')
    create.mockReturnValueOnce(false).mockReturnValueOnce(true)
    const wrapper = mount(CreateArchiveDialog, { props: { items: [s.files[1]!] } })
    await wrapper.find('#archivename').setValue('x.rar')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.find('#archivename').setValue('x.zip')
    await wrapper.find('form').trigger('submit')
    expect(create).toHaveBeenLastCalledWith([s.files[1]], 'x.zip')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})

describe('ExtractDialog', () => {
  it('extracts into the current directory by default', async () => {
    const s = store()
    const extract = vi.spyOn(s, 'extractFile').mockResolvedValue(true)
    const wrapper = mount(ExtractDialog, { props: { filename: 'pkg.zip' } })
    expect(wrapper.text()).toContain('Extract file: pkg.zip')
    await wrapper.find('form').trigger('submit')
    expect(extract).toHaveBeenCalledWith('pkg.zip', './')
  })

  it('selects the suggested and custom locations', async () => {
    const s = store()
    const extract = vi.spyOn(s, 'extractFile').mockResolvedValue(true)
    const wrapper = mount(ExtractDialog, { props: { filename: 'pkg.zip' } })
    const readonly = wrapper.findAll('.ifm-extract-location-input')
    expect(readonly[1]!.attributes('placeholder')).toBe('pkg')
    await readonly[1]!.trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(extract).toHaveBeenLastCalledWith('pkg.zip', './pkg')

    await readonly[0]!.trigger('click')
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios[0]!.element.checked).toBe(true)

    await wrapper.find('#extractCustomLocation').trigger('focus')
    expect(radios[2]!.element.checked).toBe(true)
    await wrapper.find('#extractCustomLocation').setValue('/elsewhere')
    await wrapper.find('form').trigger('submit')
    expect(extract).toHaveBeenLastCalledWith('pkg.zip', '/elsewhere')
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)
  })
})

describe('UploadConfirmOverwriteDialog', () => {
  it('lists the files and uploads after confirmation', async () => {
    const s = store()
    const upload = vi.spyOn(s, 'uploadFiles').mockImplementation(() => {})
    const files = [new File(['x'], 'a.txt')]
    const wrapper = mount(UploadConfirmOverwriteDialog, {
      props: { files, existing: ['a.txt'], newfilename: 'n.txt' },
    })
    expect(wrapper.findAll('li').map((l) => l.text())).toEqual(['a.txt'])
    await wrapper.find('form').trigger('submit')
    expect(upload).toHaveBeenCalledWith(files, 'n.txt', true)
    await wrapper.find('#buttonCancel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
