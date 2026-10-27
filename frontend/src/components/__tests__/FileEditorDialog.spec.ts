import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises, rawFile, setupStore } from '@/__tests__/helpers'
import FileEditorDialog from '../dialogs/FileEditorDialog.vue'

/** Fake of the Ace editor API used by the dialog. */
function fakeAce(modelist?: (p: string) => string) {
  const sessionOptions: Record<string, unknown> = { wrap: 'off', useSoftTabs: true, tabSize: 4 }
  const editorOptions: Record<string, unknown> = { showInvisibles: false }
  const listeners: (() => void)[] = []
  const commands: { name: string; exec: (e: unknown) => void }[] = []
  const session = {
    value: '',
    $modeId: 'ace/mode/text' as string | undefined,
    setValue: vi.fn((v: string) => (session.value = v)),
    setMode: vi.fn((m: string) => (session.$modeId = m)),
    getOption: (n: string) => sessionOptions[n],
    setOption: vi.fn((n: string, v: unknown) => (sessionOptions[n] = v)),
  }
  const editor = {
    getValue: () => session.value,
    getSession: () => session,
    getOption: (n: string) => editorOptions[n],
    setOption: vi.fn((n: string, v: unknown) => (editorOptions[n] = v)),
    on: (_: string, cb: () => void) => listeners.push(cb),
    focus: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
    container: document.createElement('div'),
    commands: { addCommand: (c: (typeof commands)[number]) => commands.push(c) },
  }
  const ace = {
    edit: vi.fn(() => editor),
    require: vi.fn(() =>
      modelist ? { getModeForPath: (p: string) => ({ mode: modelist(p) }) } : undefined,
    ),
  }
  const change = (value: string) => {
    session.value = value
    listeners.forEach((l) => l())
  }
  return { ace, editor, session, sessionOptions, editorOptions, commands, change }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setup(props = { filename: 'a.txt', content: 'hello', isNew: false }, config = {}) {
  const store = setupStore({ config, files: [rawFile('a.txt'), rawFile('taken.txt')] })
  const fake = fakeAce((p) => (p.endsWith('.php') ? 'ace/mode/php' : 'ace/mode/text'))
  vi.stubGlobal('ace', fake.ace)
  const save = vi.spyOn(store, 'saveFile').mockResolvedValue(true)
  const wrapper = mount(FileEditorDialog, { props, attachTo: document.body })
  return { store, fake, save, wrapper }
}

describe('FileEditorDialog', () => {
  it('loads the content into ace and saves it', async () => {
    const { fake, save, wrapper } = setup()
    expect(fake.session.setValue).toHaveBeenCalledWith('hello')
    expect(fake.editor.focus).toHaveBeenCalled()
    fake.change('changed')
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    expect(save).toHaveBeenCalledWith('a.txt', 'changed')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.find('#buttonClose').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(fake.editor.destroy).toHaveBeenCalled()
  })

  it('prevents dismissing with unsaved changes', async () => {
    const { fake, wrapper } = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    fake.change('x')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('validates the file name of new and renamed files', async () => {
    const { save, wrapper } = setup({ filename: 'newfile.txt', content: '', isNew: true })
    const input = wrapper.find('#filename')
    await input.setValue('taken.txt')
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    expect(save).not.toHaveBeenCalled()
    expect(wrapper.find('#filenameError').text()).toBe('This name is already taken.')
    await input.setValue('free.txt')
    expect(input.classes()).not.toContain('is-invalid')
    await input.setValue('free2.txt')
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    expect(save).toHaveBeenCalledWith('free2.txt', '')
  })

  it('allows saving the existing file again after saving it under a new name', async () => {
    const { store, save, wrapper } = setup()
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    await wrapper.find('#filename').setValue('b.txt')
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    store.files = [...store.files, { ...store.files[0]!, name: 'b.txt' }]
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('changes editor options', async () => {
    const { fake, wrapper } = setup(undefined, { ace_includes: '|ext-modelist|mode-php' })
    expect(wrapper.find('.ifm-editor-options').exists()).toBe(false)
    await wrapper.find('#editoroptions').trigger('click')
    expect(wrapper.find('.ifm-editor-options').exists()).toBe(true)
    expect((wrapper.find('#editor-softtabs').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.find('#editor-tabsize').element as HTMLInputElement).value).toBe('4')

    await wrapper.find('#editor-wordwrap').setValue(true)
    await wrapper.find('#editor-invisible-chars').setValue(true)
    await wrapper.find('#editor-softtabs').setValue(false)
    await wrapper.find('#editor-tabsize').setValue('2')
    expect(fake.sessionOptions).toMatchObject({ wrap: true, useSoftTabs: false, tabSize: 2 })
    expect(fake.editorOptions.showInvisibles).toBe(true)

    const options = wrapper.findAll('#editor-syntax option').map((o) => o.text())
    expect(options).toEqual(['text', 'php'])
    await wrapper.find('#editor-syntax').setValue('ace/mode/php')
    expect(fake.session.setMode).toHaveBeenCalledWith('ace/mode/php')

    await wrapper.find('#editoroptions').trigger('click')
    expect(wrapper.find('.ifm-editor-options').exists()).toBe(false)
    fake.sessionOptions.wrap = 'free'
    fake.session.$modeId = undefined
    await wrapper.find('#editoroptions').trigger('click')
    expect((wrapper.find('#editor-wordwrap').element as HTMLInputElement).checked).toBe(true)
  })

  it('detects the syntax mode with the modelist extension', () => {
    const { fake } = setup(
      { filename: 'x.php', content: '<?php', isNew: false },
      {
        ace_includes: '|ext-modelist|mode-php',
      },
    )
    expect(fake.session.setMode).toHaveBeenCalledWith('ace/mode/php')
  })

  it('does not set modes which are not compiled in', () => {
    const { fake } = setup(
      { filename: 'x.php', content: '', isNew: false },
      {
        ace_includes: '|ext-modelist|mode-json',
      },
    )
    expect(fake.session.setMode).not.toHaveBeenCalled()
  })

  it('toggles fullscreen with the registered command', async () => {
    vi.useFakeTimers()
    try {
      const { fake, wrapper } = setup()
      const cmd = fake.commands.find((c) => c.name === 'toggleFullscreen')!
      cmd.exec(fake.editor)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#content').classes()).toContain('ifm-editor-fullscreen')
      vi.runAllTimers()
      expect(fake.editor.resize).toHaveBeenCalled()
      cmd.exec(fake.editor)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#content').classes()).not.toContain('ifm-editor-fullscreen')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a missing editor', async () => {
    const store = setupStore()
    const wrapper = mount(FileEditorDialog, {
      props: { filename: 'a', content: '', isNew: true },
    })
    await flushPromises()
    expect(store.notifications[0]?.message).toBe('This file cannot be displayed or edited.')
    await wrapper.find('#buttonSaveNotClose').trigger('click')
    expect(store.notifications).toHaveLength(1)
  })
})
