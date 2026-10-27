<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useIfmStore } from '@/stores/ifm'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import AppInfo from './components/AppInfo.vue'
import ContextMenu from './components/ContextMenu.vue'
import DialogHost from './components/DialogHost.vue'
import FileDropOverlay from './components/FileDropOverlay.vue'
import FileTable from './components/FileTable.vue'
import LoginDialog from './components/LoginDialog.vue'
import NavBar from './components/NavBar.vue'
import NotificationList from './components/NotificationList.vue'
import TaskQueue from './components/TaskQueue.vue'

const store = useIfmStore()

useKeyboardShortcuts()

function onPopState(e: PopStateEvent) {
  const dir = (e.state as { dir?: string } | null)?.dir ?? ''
  void store.changeDirectory(dir, { pushState: false, absolute: true })
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (store.tasks.length > 0) {
    e.preventDefault()
    e.returnValue = store.t('remaining_tasks')
    return store.t('remaining_tasks')
  }
}

onMounted(() => {
  window.addEventListener('popstate', onPopState)
  window.addEventListener('beforeunload', onBeforeUnload)
  void store.init()
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div class="ifm-app" :class="{ 'ifm-inline': store.config.inline }">
    <div v-if="store.status === 'error'" class="container mt-3">
      <div class="alert alert-danger" role="alert">{{ store.initError }}</div>
    </div>
    <LoginDialog v-else-if="store.status === 'login'" />
    <template v-else-if="store.status === 'ready'">
      <NavBar />
      <FileDropOverlay />
      <main role="main">
        <div class="container">
          <FileTable />
        </div>
        <AppInfo />
      </main>
      <TaskQueue />
      <ContextMenu />
      <DialogHost />
    </template>
    <NotificationList />
  </div>
</template>
