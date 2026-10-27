<script setup lang="ts">
import type { Component } from 'vue'
import { useIfmStore, type DialogName } from '@/stores/ifm'
import AjaxRequestDialog from './dialogs/AjaxRequestDialog.vue'
import CopyMoveDialog from './dialogs/CopyMoveDialog.vue'
import CreateArchiveDialog from './dialogs/CreateArchiveDialog.vue'
import CreateDirDialog from './dialogs/CreateDirDialog.vue'
import DeleteDialog from './dialogs/DeleteDialog.vue'
import ExtractDialog from './dialogs/ExtractDialog.vue'
import FileEditorDialog from './dialogs/FileEditorDialog.vue'
import RemoteUploadDialog from './dialogs/RemoteUploadDialog.vue'
import RenameDialog from './dialogs/RenameDialog.vue'
import SearchDialog from './dialogs/SearchDialog.vue'
import UploadConfirmOverwriteDialog from './dialogs/UploadConfirmOverwriteDialog.vue'
import UploadDialog from './dialogs/UploadDialog.vue'

const store = useIfmStore()

const dialogs: Record<DialogName, Component> = {
  ajaxRequest: AjaxRequestDialog,
  copyMove: CopyMoveDialog,
  createArchive: CreateArchiveDialog,
  createDir: CreateDirDialog,
  delete: DeleteDialog,
  extract: ExtractDialog,
  file: FileEditorDialog,
  remoteUpload: RemoteUploadDialog,
  rename: RenameDialog,
  search: SearchDialog,
  uploadConfirmOverwrite: UploadConfirmOverwriteDialog,
  upload: UploadDialog,
}
</script>

<template>
  <!-- a new key per opened dialog guarantees fresh dialog state -->
  <component
    :is="dialogs[store.dialog.name]"
    v-if="store.dialog"
    :key="store.dialogKey"
    v-bind="store.dialog.props"
    @close="store.closeDialog()"
  />
</template>
