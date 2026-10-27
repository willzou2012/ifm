<script setup lang="ts">
import { ref } from 'vue'
import type { FolderNode } from '@/types'
import { decodeEntities } from '@/utils/html'

const props = defineProps<{
  node: FolderNode
  level: number
  selectedPath: string | null
  loadChildren: (path: string) => Promise<FolderNode[]>
}>()

const emit = defineEmits<{ select: [path: string] }>()

const expanded = ref(false)
const loading = ref(false)
const children = ref<FolderNode[] | null>(null)

async function toggle() {
  if (expanded.value) {
    expanded.value = false
    return
  }
  if (children.value === null) {
    loading.value = true
    try {
      children.value = await props.loadChildren(props.node.dataAttr.path)
    } catch {
      children.value = []
    } finally {
      loading.value = false
    }
  }
  expanded.value = true
}
</script>

<template>
  <li
    class="list-group-item node-copyMoveTree"
    :class="{ 'node-selected': selectedPath === node.dataAttr.path }"
    :data-path="node.dataAttr.path"
    :style="{ paddingLeft: `${0.75 + level * 1.25}rem` }"
    @click="emit('select', node.dataAttr.path)"
  >
    <span v-if="node.lazyLoad" class="expand-icon" @click.stop="toggle">
      <span v-if="loading" class="icon fa fa-spinner fa-spin" />
      <span v-else-if="expanded" class="icon fa fa-minus-square-o" />
      <span v-else class="icon fa fa-plus-square" />
    </span>
    <span v-else class="icon expand-placeholder" />
    {{ decodeEntities(node.text) }}
  </li>
  <template v-if="expanded && children">
    <FolderTreeNode
      v-for="child in children"
      :key="child.dataAttr.path"
      :node="child"
      :level="level + 1"
      :selected-path="selectedPath"
      :load-children="loadChildren"
      @select="emit('select', $event)"
    />
  </template>
</template>
