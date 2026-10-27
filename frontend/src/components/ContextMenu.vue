<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useIfmStore } from '@/stores/ifm'
import { useFileActions, type ContextAction } from '@/composables/useFileActions'

const store = useIfmStore()
const { contextMenuGroups, runContextAction } = useFileActions()

const menu = ref<HTMLElement>()
const position = ref({ left: 0, top: 0 })

const clicked = computed(() => {
  const guid = store.contextMenu?.guid
  return store.files.find((f) => f.guid === guid) ?? null
})

const groups = computed(() =>
  clicked.value ? contextMenuGroups(clicked.value, store.selectedItems) : [],
)

function close() {
  store.contextMenu = null
}

function run(action: ContextAction) {
  const item = clicked.value
  const selected = store.selectedItems
  close()
  if (item) void runContextAction(action.id, item, selected)
}

// keep the menu inside the viewport
watch(
  () => store.contextMenu,
  async (cm) => {
    if (!cm) return
    position.value = { left: cm.x, top: cm.y }
    await nextTick()
    const el = menu.value
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    position.value = {
      left: Math.max(0, Math.min(cm.x, window.innerWidth - width)),
      top: Math.max(0, Math.min(cm.y, window.innerHeight - height)),
    }
  },
)

function onDocumentMousedown(e: MouseEvent) {
  if (store.contextMenu && !menu.value?.contains(e.target as Node)) close()
}

function onKeydown(e: KeyboardEvent) {
  if (store.contextMenu && e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMousedown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
})
</script>

<template>
  <div
    v-if="store.contextMenu && groups.length > 0"
    ref="menu"
    class="dropdown-menu show ifm-context-menu"
    role="menu"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @contextmenu.prevent
  >
    <template v-for="(group, gi) in groups" :key="gi">
      <div v-if="gi > 0" class="dropdown-divider" />
      <a
        v-for="action in group"
        :key="action.id"
        class="dropdown-item"
        role="menuitem"
        href="#"
        :data-action="action.id"
        @click.prevent="run(action)"
      >
        <span :class="action.icon" />
        {{ action.label }}
        <span v-if="action.badge" class="badge badge-secondary">{{ action.badge }}</span>
      </a>
    </template>
  </div>
</template>
