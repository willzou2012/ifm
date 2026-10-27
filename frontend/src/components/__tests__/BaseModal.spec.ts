import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseModal from '../BaseModal.vue'
import { flushPromises } from '@/__tests__/helpers'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
})

const content = '<input type="hidden"><input type="checkbox"><input id="first"><button>b</button>'

describe('BaseModal', () => {
  it('renders the slot, locks scrolling and focuses the first input', async () => {
    const wrapper = mount(BaseModal, {
      props: { large: true },
      slots: { default: content },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.find('.modal-dialog').classes()).toContain('modal-lg')
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(document.activeElement?.id).toBe('first')
    wrapper.unmount()
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('prefers elements with autofocus', async () => {
    mount(BaseModal, {
      slots: { default: '<input id="a"><input id="b" autofocus>' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.activeElement?.id).toBe('b')
  })

  it('closes via backdrop and Escape', async () => {
    const wrapper = mount(BaseModal, { slots: { default: content }, attachTo: document.body })
    await wrapper.find('.modal').trigger('mousedown')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(wrapper.emitted('close')).toHaveLength(2)
    // clicks inside the dialog do not close it
    await wrapper.find('.modal-content').trigger('mousedown')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('cannot be dismissed when static or vetoed', async () => {
    const stat = mount(BaseModal, { props: { static: true }, attachTo: document.body })
    await stat.find('.modal').trigger('mousedown')
    expect(stat.emitted('close')).toBeUndefined()
    stat.unmount()

    let allow = false
    const veto = mount(BaseModal, { props: { canDismiss: () => allow }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(veto.emitted('close')).toBeUndefined()
    allow = true
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(veto.emitted('close')).toHaveLength(1)
  })
})
