<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { fileFingerprint } from '@/utils/files'

const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const pendingFiles = ref<File[]>([])
const newfilename = ref('')

const label = computed(() => {
  const n = pendingFiles.value.length
  if (n === 0) return store.t('upload_file')
  if (n === 1) return pendingFiles.value[0]!.name
  return `${store.t('upload_file')} (${n})`
})

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const seen = new Set(pendingFiles.value.map(fileFingerprint))
  for (const f of Array.from(input.files ?? [])) {
    const fp = fileFingerprint(f)
    if (!seen.has(fp)) {
      seen.add(fp)
      pendingFiles.value.push(f)
    }
  }
  // allow selecting the same file again after removing it
  input.value = ''
}

function remove(index: number) {
  pendingFiles.value.splice(index, 1)
}

function submit() {
  if (pendingFiles.value.length === 0) {
    store.notify(store.t('upload_no_file'), 'e')
    return
  }
  const files = pendingFiles.value.slice()
  emit('close')
  store.uploadFiles(files, files.length === 1 ? newfilename.value : undefined)
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formUploadFile" @submit.prevent="submit">
      <div class="modal-body">
        <fieldset>
          <div class="form-group mb-3">
            <div class="custom-file">
              <label class="custom-file-label" for="fileselect">{{ label }}</label>
              <input
                id="fileselect"
                class="custom-file-input"
                type="file"
                name="files"
                multiple
                @change="onFilesSelected"
              />
            </div>
          </div>
          <div v-if="pendingFiles.length > 0" id="uploadFileListContainer" class="form-group mb-3">
            <ul id="uploadFileList" class="list-group list-group-flush border rounded">
              <li
                v-for="(file, index) in pendingFiles"
                :key="fileFingerprint(file)"
                class="list-group-item d-flex justify-content-between align-items-center py-2"
              >
                <span class="text-truncate mr-2" :title="file.name">{{ file.name }}</span>
                <button
                  type="button"
                  class="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                  :title="store.t('delete')"
                  :data-upload-remove="index"
                  @click="remove(index)"
                >
                  <span class="icon fa fa-trash" />
                </button>
              </li>
            </ul>
          </div>
          <div v-if="pendingFiles.length === 1" id="filenameContainer" class="form-group mb-0">
            <label class="sr-only" for="filename">{{ store.t('filename_new') }}</label>
            <input
              id="filename"
              v-model="newfilename"
              class="form-control"
              type="text"
              name="newfilename"
              :placeholder="store.t('filename_new')"
            />
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonUpload" type="submit" class="btn btn-primary">
          {{ store.t('upload') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
