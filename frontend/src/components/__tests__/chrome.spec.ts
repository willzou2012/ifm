import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises, rawDir, rawFile, setupStore } from '@/__tests__/helpers'
import AppInfo from '../AppInfo.vue'
import ContextMenu from '../ContextMenu.vue'
import DialogHost from '../DialogHost.vue'
import FileDropOverlay from '../FileDropOverlay.vue'
import LoginDialog from '../LoginDialog.vue'
import NavBar from '../NavBar.vue'
import NotificationItem from '../NotificationItem.vue'
import NotificationList from '../NotificationList.vue'
import TaskQueue from '../TaskQueue.vue'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

describe('NavBar', () => {
  it('shows the enabled actions and opens their dialogs', async () => {
    const store = setupStore({ config: { auth: 1 } })
    const refresh = vi.spyOn(store, 'refreshFileTable').mockResolvedValue()
    const wrapper = mount(NavBar)
    expect(wrapper.find('nav').classes()).toContain('fixed-top')
    await wrapper.find('#refresh').trigger('click')
    expect(refresh).toHaveBeenCalled()
    const dialogs: [string, string][] = [
      ['#search', 'search'],
      ['#upload', 'upload'],
      ['#createFile', 'file'],
      ['#createDir', 'createDir'],
      ['#buttonRemoteUpload', 'remoteUpload'],
      ['#buttonAjaxRequest', 'ajaxRequest'],
    ]
    for (const [selector, name] of dialogs) {
      await wrapper.find(selector).trigger('click')
      expect(store.dialog?.name).toBe(name)
    }
    expect(wrapper.find('#buttonLogout').attributes('href')).toBe('?api=logout')
  })

  it('hides disabled actions and is not fixed when inline', () => {
    setupStore({
      config: {
        inline: true,
        showrefresh: 0,
        search: 0,
        upload: 0,
        createfile: 0,
        createdir: 0,
        remoteupload: 0,
        ajaxrequest: 0,
        auth: 0,
      },
    })
    const wrapper = mount(NavBar)
    expect(wrapper.find('nav').classes()).not.toContain('fixed-top')
    expect(wrapper.findAll('.nav-item')).toHaveLength(0)
  })

  it('follows the current directory and changes it on Enter', async () => {
    const store = setupStore({ currentDir: 'a' })
    const cd = vi.spyOn(store, 'changeDirectory').mockResolvedValue()
    const wrapper = mount(NavBar, { attachTo: document.body })
    const input = wrapper.find('#currentDir')
    expect((input.element as HTMLInputElement).value).toBe('a')
    store.currentDir = 'b'
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('b')
    await input.setValue('/c')
    ;(input.element as HTMLInputElement).focus()
    await input.trigger('keypress', { key: 'Enter' })
    expect(cd).toHaveBeenCalledWith('/c', { absolute: true })
    expect(document.activeElement).not.toBe(input.element)
  })

  it('toggles the collapsed menu', async () => {
    setupStore()
    const wrapper = mount(NavBar)
    expect(wrapper.find('#navbarCollapse').classes()).not.toContain('show')
    await wrapper.find('.navbar-toggler').trigger('click')
    expect(wrapper.find('#navbarCollapse').classes()).toContain('show')
  })
})

describe('ContextMenu', () => {
  function setup(config = {}) {
    const store = setupStore({ config, files: [rawDir('..'), rawFile('a.txt'), rawFile('b.txt')] })
    const wrapper = mount(ContextMenu, { attachTo: document.body })
    return { store, wrapper }
  }

  it('shows the entries of the clicked item and runs them', async () => {
    const { store, wrapper } = setup()
    expect(wrapper.find('.ifm-context-menu').exists()).toBe(false)
    store.contextMenu = { x: 10, y: 20, guid: store.files[1]!.guid }
    await flushPromises()
    const menu = wrapper.find('.ifm-context-menu')
    expect(menu.attributes('style')).toContain('left: 10px')
    expect(menu.findAll('.dropdown-divider')).toHaveLength(1)
    expect(menu.findAll('.dropdown-item').map((i) => i.attributes('data-action'))).toEqual([
      'edit',
      'rename',
      'copylink',
      'copymove',
      'download',
      'createarchive',
      'delete',
    ])
    await menu.find('[data-action="rename"]').trigger('click')
    expect(store.contextMenu).toBeNull()
    expect(store.dialog).toEqual({ name: 'rename', props: { filename: 'a.txt' } })
  })

  it('shows badges for the selection', async () => {
    const { store, wrapper } = setup()
    store.selected = [store.files[1]!.guid, store.files[2]!.guid]
    store.contextMenu = { x: 0, y: 0, guid: store.files[1]!.guid }
    await flushPromises()
    expect(wrapper.find('[data-action="delete"] .badge').text()).toBe('2')
    await wrapper.find('[data-action="delete"]').trigger('click')
    expect(store.dialog).toEqual({ name: 'delete', props: { items: store.selectedItems } })
  })

  it('stays within the viewport', async () => {
    const { store, wrapper } = setup()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 300,
    } as DOMRect)
    store.contextMenu = {
      x: window.innerWidth - 10,
      y: window.innerHeight - 10,
      guid: store.files[1]!.guid,
    }
    await flushPromises()
    const style = wrapper.find('.ifm-context-menu').attributes('style')
    expect(style).toContain(`left: ${window.innerWidth - 200}px`)
    expect(style).toContain(`top: ${window.innerHeight - 300}px`)
  })

  it('closes on outside clicks, Escape, scrolling and resizing', async () => {
    const { store, wrapper } = setup()
    const open = async () => {
      store.contextMenu = { x: 0, y: 0, guid: store.files[1]!.guid }
      await flushPromises()
    }
    await open()
    await wrapper.find('.ifm-context-menu').trigger('mousedown')
    expect(store.contextMenu).not.toBeNull()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(store.contextMenu).toBeNull()
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(store.contextMenu).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.contextMenu).toBeNull()
    await open()
    window.dispatchEvent(new Event('scroll'))
    expect(store.contextMenu).toBeNull()
    await open()
    window.dispatchEvent(new Event('resize'))
    expect(store.contextMenu).toBeNull()
    wrapper.unmount()
  })

  it('renders nothing for unknown items or without entries', async () => {
    const { store, wrapper } = setup({ download: 0 })
    store.contextMenu = { x: 0, y: 0, guid: 'unknown' }
    await flushPromises()
    expect(wrapper.find('.ifm-context-menu').exists()).toBe(false)
    store.contextMenu = { x: 0, y: 0, guid: store.files[0]!.guid }
    await flushPromises()
    expect(wrapper.find('.ifm-context-menu').exists()).toBe(false)
  })
})

describe('TaskQueue', () => {
  it('shows running tasks with their progress', async () => {
    const store = setupStore()
    const wrapper = mount(TaskQueue)
    expect(wrapper.find('footer').exists()).toBe(false)
    const id = store.addTask('Upload a.txt')
    store.addTask('Refresh')
    store.updateTask(id, 30)
    await flushPromises()
    expect(document.body.style.paddingBottom).toBe('9rem')
    expect(wrapper.find('[name="taskCount"]').text()).toBe('2')
    const bars = wrapper.findAll('.progress-bar')
    expect(bars.map((b) => b.text())).toEqual(['Refresh', 'Upload a.txt'])
    expect(bars[1]!.attributes('style')).toContain('width: 30%')
    await wrapper.find('[name="showAll"]').trigger('click')
    expect(wrapper.find('#waitqueue').classes()).toContain('expanded')
    store.tasks = []
    await flushPromises()
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(document.body.style.paddingBottom).toBe('')
  })
})

describe('notifications', () => {
  it('styles messages and sanitizes markup', () => {
    const types = { e: 'alert-danger', s: 'alert-success', i: 'alert-info' } as const
    for (const [type, cls] of Object.entries(types)) {
      const wrapper = mount(NotificationItem, {
        props: {
          notification: { id: '1', message: 'm<ul><li>x</li></ul><img src=x>', type: type as 'e' },
        },
      })
      expect(wrapper.classes()).toContain(cls)
      expect(wrapper.html()).toContain('<ul><li>x</li></ul>')
      expect(wrapper.find('img').exists()).toBe(false)
    }
  })

  it('dismisses after the delay, paused while hovered', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(NotificationItem, {
        props: { notification: { id: 'n1', message: 'hi', type: 'i' }, delay: 1000 },
      })
      await wrapper.trigger('mouseenter')
      vi.advanceTimersByTime(5000)
      expect(wrapper.emitted('dismiss')).toBeUndefined()
      await wrapper.trigger('mouseleave')
      vi.advanceTimersByTime(1000)
      expect(wrapper.emitted('dismiss')).toEqual([['n1']])
      await wrapper.find('button.close').trigger('click')
      expect(wrapper.emitted('dismiss')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lists the notifications of the store', async () => {
    const store = setupStore()
    const wrapper = mount(NotificationList)
    store.notify('one', 's')
    store.notify('two', 'e')
    await flushPromises()
    expect(wrapper.findAll('.ifm-notification').map((n) => n.text())).toEqual(['×one', '×two'])
    await wrapper.find('button.close').trigger('click')
    expect(store.notifications.map((n) => n.message)).toEqual(['two'])
    expect(wrapper.classes()).not.toContain('ifm-notifications-raised')
    store.openDialog('createDir', {})
    await flushPromises()
    expect(wrapper.classes()).toContain('ifm-notifications-raised')
  })
})

describe('FileDropOverlay', () => {
  function drag(type: string, types: string[], files: File[] = []) {
    const e = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(e, 'dataTransfer', { value: { types, files } })
    return e
  }

  it('shows for dragged files and uploads dropped files', async () => {
    const store = setupStore()
    const upload = vi.spyOn(store, 'uploadFiles').mockImplementation(() => {})
    const wrapper = mount(FileDropOverlay, { attachTo: document.body })
    const overlay = wrapper.find('#filedropoverlay')
    expect(overlay.isVisible()).toBe(false)

    document.dispatchEvent(drag('dragover', ['text/plain']))
    await flushPromises()
    expect(overlay.isVisible()).toBe(false)

    const over = drag('dragover', ['Files'])
    document.dispatchEvent(over)
    await flushPromises()
    expect(over.defaultPrevented).toBe(true)
    expect(overlay.isVisible()).toBe(true)
    expect(overlay.text()).toBe('Drop files to upload')

    // leaving towards a child keeps the overlay
    overlay.find('h1').element.dispatchEvent(drag('dragleave', ['Files']))
    await flushPromises()
    expect(overlay.isVisible()).toBe(true)
    overlay.element.dispatchEvent(drag('dragleave', ['Files']))
    await flushPromises()
    expect(overlay.isVisible()).toBe(false)

    document.dispatchEvent(drag('dragover', ['Files']))
    const files = [new File(['x'], 'x.txt')]
    overlay.element.dispatchEvent(drag('drop', ['Files'], files))
    await flushPromises()
    expect(upload).toHaveBeenCalledWith(files)
    expect(overlay.isVisible()).toBe(false)

    overlay.element.dispatchEvent(drag('drop', ['Files'], []))
    expect(upload).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('is inactive without upload permission or with an open dialog', async () => {
    const store = setupStore({ config: { upload: 0 } })
    const wrapper = mount(FileDropOverlay, { attachTo: document.body })
    document.dispatchEvent(drag('dragover', ['Files']))
    await flushPromises()
    expect(wrapper.find('#filedropoverlay').isVisible()).toBe(false)
    store.config.upload = 1
    store.openDialog('createDir', {})
    document.dispatchEvent(drag('dragover', ['Files']))
    await flushPromises()
    expect(wrapper.find('#filedropoverlay').isVisible()).toBe(false)
  })
})

describe('LoginDialog', () => {
  it('logs in and shows errors', async () => {
    const store = setupStore()
    const login = vi.spyOn(store, 'login').mockResolvedValueOnce('Wrong <b>credentials</b>')
    login.mockResolvedValueOnce(null)
    const wrapper = mount(LoginDialog, { attachTo: document.body })
    await flushPromises()
    expect(document.activeElement?.id).toBe('inputLogin')
    await wrapper.find('#inputLogin').setValue('admin')
    await wrapper.find('#inputPassword').setValue('pw')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(login).toHaveBeenCalledWith('admin', 'pw')
    expect(wrapper.find('.alert').html()).toContain('Wrong <b>credentials</b>')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.alert').exists()).toBe(false)
  })
})

describe('DialogHost', () => {
  it('renders the open dialog and closes it', async () => {
    const store = setupStore()
    const wrapper = mount(DialogHost)
    expect(wrapper.find('.modal').exists()).toBe(false)
    store.openDialog('rename', { filename: 'x.txt' })
    await flushPromises()
    expect(wrapper.find('#formRenameFile').exists()).toBe(true)
    await wrapper.find('#buttonCancel').trigger('click')
    expect(store.dialog).toBeNull()
  })
})

describe('AppInfo', () => {
  it('links the release of the version placeholder', () => {
    setupStore()
    const wrapper = mount(AppInfo)
    expect(wrapper.text()).toContain('IFM - improved file manager')
    expect(wrapper.find('a').attributes('href')).toBe(
      'https://github.com/misterunknown/ifm/releases/tag/IFM_VERSION',
    )
  })
})
