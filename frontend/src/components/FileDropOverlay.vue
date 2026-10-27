<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useIfmStore } from '@/stores/ifm'

const store = useIfmStore()
const visible = ref(false)

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

function onDocumentDragover(e: DragEvent) {
  if (!store.config.upload || store.dialog || !hasFiles(e)) return
  e.preventDefault()
  e.stopPropagation()
  visible.value = true
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  visible.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length > 0) store.uploadFiles(files)
}

function onDragleave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.target === e.currentTarget) visible.value = false
}

onMounted(() => document.addEventListener('dragover', onDocumentDragover))
onBeforeUnmount(() => document.removeEventListener('dragover', onDocumentDragover))
</script>

<template>
  <div
    v-show="visible"
    id="filedropoverlay"
    @dragover.prevent
    @drop="onDrop"
    @dragleave="onDragleave"
  >
    <h1>{{ store.t('upload_drop') }}</h1>
  </div>
</template>
