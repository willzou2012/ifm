<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { filenameFromUrl, uniqueFilename } from '@/utils/files'

const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const url = ref('')
const filename = ref('')
const method = ref<'curl' | 'file'>('curl')
/** once the user typed a file name, it is no longer derived from the URL */
const filenameTouched = ref(false)

function onUrlChange() {
  if (filenameTouched.value) return
  const name = filenameFromUrl(url.value)
  if (name) filename.value = uniqueFilename(name, store.fileNames)
}

function submit() {
  void store.remoteUpload(url.value, filename.value, method.value)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formRemoteUpload" @submit.prevent>
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="url">{{ store.t('upload_remote_url') }}</label>
            <input
              id="url"
              v-model="url"
              class="form-control"
              type="url"
              name="url"
              placeholder="https://..."
              autocomplete="off"
              autofocus
              required
              @input="onUrlChange"
            />
          </div>
          <div class="form-group">
            <label for="filename">{{ store.t('filename') }}</label>
            <input
              id="filename"
              v-model="filename"
              class="form-control"
              type="text"
              name="filename"
              :placeholder="store.t('filename')"
              required
              @keyup="filenameTouched = true"
            />
          </div>
          <div class="form-group">
            <legend>{{ store.t('method') }}</legend>
            <div class="form-check form-check-inline">
              <input
                id="radiocurl"
                v-model="method"
                class="form-check-input"
                type="radio"
                name="method"
                value="curl"
              />
              <label class="form-check-label" for="radiocurl">cURL</label>
            </div>
            <div class="form-check form-check-inline">
              <input
                id="radiofile"
                v-model="method"
                class="form-check-input"
                type="radio"
                name="method"
                value="file"
              />
              <label class="form-check-label" for="radiofile">file</label>
            </div>
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonUpload" type="button" class="btn btn-primary" @click="submit">
          {{ store.t('upload') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
