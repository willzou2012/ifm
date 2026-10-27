<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { Notification } from '@/types'
import { sanitizeHtml } from '@/utils/html'

const props = withDefaults(defineProps<{ notification: Notification; delay?: number }>(), {
  delay: 3000,
})
const emit = defineEmits<{ dismiss: [id: string] }>()

const alertClass = computed(() => {
  switch (props.notification.type) {
    case 'e':
      return 'alert-danger'
    case 's':
      return 'alert-success'
    default:
      return 'alert-info'
  }
})
// server messages may contain simple markup such as lists of failed files
const html = computed(() => sanitizeHtml(props.notification.message))

let timer: ReturnType<typeof setTimeout> | undefined
function start() {
  timer = setTimeout(() => emit('dismiss', props.notification.id), props.delay)
}
function pause() {
  clearTimeout(timer)
}

onMounted(start)
onBeforeUnmount(pause)
</script>

<template>
  <div
    class="alert alert-dismissible ifm-notification"
    :class="alertClass"
    role="alert"
    @mouseenter="pause"
    @mouseleave="start"
  >
    <button
      type="button"
      class="close"
      aria-label="Close"
      @click="emit('dismiss', notification.id)"
    >
      <span aria-hidden="true">&times;</span>
    </button>
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized above -->
    <span v-html="html" />
  </div>
</template>
