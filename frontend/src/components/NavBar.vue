<script setup lang="ts">
import { ref, watch } from 'vue'
import { useIfmStore } from '@/stores/ifm'

const store = useIfmStore()
const collapsed = ref(true)
const dirInput = ref(store.currentDir)

watch(
  () => store.currentDir,
  (dir) => (dirInput.value = dir),
)

function submitDir(e: KeyboardEvent) {
  void store.changeDirectory(dirInput.value, { absolute: true })
  ;(e.target as HTMLInputElement).blur()
}
</script>

<template>
  <nav
    class="navbar navbar-expand-lg navbar-dark bg-dark"
    :class="{ 'fixed-top': !store.config.inline }"
  >
    <div class="container">
      <a class="navbar-brand" href="#">IFM</a>
      <button
        class="navbar-toggler"
        type="button"
        aria-controls="navbarCollapse"
        :aria-expanded="!collapsed"
        :aria-label="store.t('toggle_nav')"
        @click="collapsed = !collapsed"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div id="navbarCollapse" class="collapse navbar-collapse" :class="{ show: !collapsed }">
        <div class="navbar-nav mr-auto">
          <form class="form-inline mt-2 mt-md-0" @submit.prevent>
            <div class="input-group">
              <div class="input-group-prepend">
                <span id="currentDirLabel" class="input-group-text">
                  {{ store.t('path_content') }} /
                </span>
              </div>
              <input
                id="currentDir"
                v-model="dirInput"
                class="form-control"
                aria-describedby="currentDirLabel"
                type="text"
                @keypress.enter.prevent="submitDir"
              />
            </div>
          </form>
        </div>
        <ul class="navbar-nav">
          <li v-if="store.config.showrefresh" class="nav-item">
            <a id="refresh" class="nav-link" href="#" @click.prevent="store.refreshFileTable()">
              <span :title="store.t('refresh')" class="fa fa-2x fa-refresh fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('refresh') }}</span>
            </a>
          </li>
          <li v-if="store.config.search" class="nav-item">
            <a
              id="search"
              class="nav-link"
              href="#"
              @click.prevent="store.openDialog('search', {})"
            >
              <span :title="store.t('search')" class="fa fa-2x fa-search fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('search') }}</span>
            </a>
          </li>
          <li v-if="store.config.upload" class="nav-item">
            <a
              id="upload"
              class="nav-link"
              href="#"
              @click.prevent="store.openDialog('upload', {})"
            >
              <span :title="store.t('upload')" class="fa fa-2x fa-upload fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('upload') }}</span>
            </a>
          </li>
          <li v-if="store.config.createfile" class="nav-item">
            <a id="createFile" class="nav-link" href="#" @click.prevent="store.newFile()">
              <span :title="store.t('file_new')" class="fa-stack">
                <span class="fa fa-file-o fa-stack-2x fa-fw" />
                <span class="fa fa-plus fa-stack-1x fa-fw" />
              </span>
              <span class="d-inline d-lg-none">{{ store.t('file_new') }}</span>
            </a>
          </li>
          <li v-if="store.config.createdir" class="nav-item">
            <a
              id="createDir"
              class="nav-link"
              href="#"
              @click.prevent="store.openDialog('createDir', {})"
            >
              <span :title="store.t('folder_new')" class="fa-stack">
                <span class="fa fa-fw fa-folder-o fa-stack-2x" />
                <span class="fa fa-fw fa-plus fa-stack-1x" />
              </span>
              <span class="d-inline d-lg-none">{{ store.t('folder_new') }}</span>
            </a>
          </li>
          <li v-if="store.config.remoteupload" class="nav-item">
            <a
              id="buttonRemoteUpload"
              class="nav-link"
              href="#"
              @click.prevent="store.openDialog('remoteUpload', {})"
            >
              <span :title="store.t('upload_remote')" class="fa fa-2x fa-cloud-upload fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('upload_remote') }}</span>
            </a>
          </li>
          <li v-if="store.config.ajaxrequest" class="nav-item">
            <a
              id="buttonAjaxRequest"
              class="nav-link"
              href="#"
              @click.prevent="store.openDialog('ajaxRequest', {})"
            >
              <span :title="store.t('ajax_request')" class="fa fa-2x fa-external-link fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('ajax_request') }}</span>
            </a>
          </li>
          <li v-if="store.config.auth" class="nav-item">
            <a id="buttonLogout" href="?api=logout" class="nav-link">
              <span :title="store.t('logout')" class="fa fa-2x fa-sign-out fa-fw" />
              <span class="d-inline d-lg-none">{{ store.t('logout') }}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
