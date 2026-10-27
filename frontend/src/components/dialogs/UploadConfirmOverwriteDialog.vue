<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'

const props = defineProps<{ files: File[]; existing: string[]; newfilename?: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

function confirm() {
  emit('close')
  store.uploadFiles(props.files, props.newfilename, true)
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formUploadConfirmOverwrite" @submit.prevent="confirm">
      <div class="modal-body">
        {{ store.t('upload_overwrite_hint') }}
        <ul>
          <li v-for="name in existing" :key="name">{{ name }}</li>
        </ul>
        {{ store.t('upload_overwrite_confirm') }}
      </div>
      <div class="modal-footer">
        <button id="buttonConfirm" type="submit" class="btn btn-primary">
          {{ store.t('upload') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
