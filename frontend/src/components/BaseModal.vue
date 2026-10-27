<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    large?: boolean
    /** static modals cannot be dismissed via backdrop click or Escape */
    static?: boolean
    /** called before dismissing via backdrop/Escape; return false to keep it open */
    canDismiss?: () => boolean
  }>(),
  { large: false, static: false, canDismiss: undefined },
)

const emit = defineEmits<{ close: [] }>()

const root = ref<HTMLElement>()

function dismiss() {
  if (props.static) return
  if (props.canDismiss && !props.canDismiss()) return
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    dismiss()
  }
}

onMounted(async () => {
  document.body.classList.add('modal-open')
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  const el = root.value
  if (!el) return
  const target =
    el.querySelector<HTMLElement>('[autofocus]') ??
    el.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), button',
    )
  target?.focus()
})

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open')
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div>
    <div
      id="ifmmodal"
      ref="root"
      class="modal d-block"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @mousedown.self="dismiss"
    >
      <div class="modal-dialog" :class="{ 'modal-lg': large }" role="document">
        <div class="modal-content">
          <slot />
        </div>
      </div>
    </div>
    <div class="modal-backdrop show" />
  </div>
</template>
