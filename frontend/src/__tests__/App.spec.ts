import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { IFM } from '@/IFM'
import { useIfmStore } from '@/stores/ifm'
import { defaultConfig, flushPromises, i18n, mockBackend, rawFile } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
})

function backend(auth = 'OK') {
  return mockBackend({
    getConfig: () => defaultConfig,
    getI18N: () => i18n,
    checkAuth: () => ({ status: auth }),
    getFiles: () => [rawFile('a.txt')],
    getRealpath: (p) => ({ realpath: p.get('dir') }),
  })
}

describe('App', () => {
  it('initializes and renders the file manager', async () => {
    backend()
    setActivePinia(createPinia())
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('nav.navbar').exists()).toBe(true)
    expect(wrapper.find('#filetable tr[data-filename="a.txt"]').exists()).toBe(true)
    expect(wrapper.find('.ifminfo').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the login dialog', async () => {
    backend('ERROR')
    setActivePinia(createPinia())
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('#loginForm').exists()).toBe(true)
    expect(wrapper.find('#filetable').exists()).toBe(false)
  })

  it('shows initialization errors', async () => {
    mockBackend({ getConfig: () => new Error('down') })
    setActivePinia(createPinia())
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('.alert-danger').text()).toBe('Could not load configuration.')
  })

  it('follows the browser history and warns about running tasks', async () => {
    backend()
    setActivePinia(createPinia())
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    const store = useIfmStore()
    const cd = vi.spyOn(store, 'changeDirectory').mockResolvedValue()
    window.dispatchEvent(new PopStateEvent('popstate', { state: { dir: 'docs' } }))
    expect(cd).toHaveBeenCalledWith('docs', { pushState: false, absolute: true })
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    expect(cd).toHaveBeenLastCalledWith('', { pushState: false, absolute: true })

    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)
    store.addTask('busy')
    const busy = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(busy)
    expect(busy.defaultPrevented).toBe(true)

    wrapper.unmount()
    window.dispatchEvent(new PopStateEvent('popstate', { state: { dir: 'x' } }))
    expect(cd).toHaveBeenCalledTimes(2)
  })
})

describe('IFM', () => {
  it('mounts the application into an element', async () => {
    const fetchMock = backend()
    document.body.innerHTML = '<div id="ifm"></div>'
    const ifm = new IFM({ api: '/custom/ifm.php' })
    expect(ifm.api).toBe('/custom/ifm.php')
    ifm.init('ifm')
    await flushPromises()
    expect(fetchMock.mock.calls[0]![0]).toBe('/custom/ifm.php')
    expect(document.querySelector('#filetable')).not.toBeNull()
    ifm.destroy()
    expect(document.querySelector('#filetable')).toBeNull()
    ifm.destroy()
  })

  it('defaults to the current URL without hash', () => {
    history.replaceState(null, '', '/ifm.php?lang=de#docs')
    expect(new IFM().api).toBe(`${window.location.origin}/ifm.php?lang=de`)
  })

  it('fails for unknown elements', () => {
    expect(() => new IFM().init('missing')).toThrow('IFM: element #missing not found')
  })

  it('is exposed globally by the bundle entry', async () => {
    await import('@/main')
    expect(window.IFM).toBe(IFM)
  })
})
