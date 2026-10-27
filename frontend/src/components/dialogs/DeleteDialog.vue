<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import type { FileItem } from '@/types'

const props = defineProps<{ items: FileItem[] }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

function confirm() {
  void store.deleteFiles(props.items)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formDeleteFiles" @submit.prevent="confirm">
      <div class="modal-body">
        <label>
          {{ store.t('file_delete_confirm') }}
          <code>{{ items.length > 1 ? items.length : items[0]?.name }}</code
          >?
        </label>
      </div>
      <div class="modal-footer">
        <button id="buttonYes" type="submit" class="btn btn-danger">
          {{ store.t('delete') }}
        </button>
        <button id="buttonNo" type="button" class="btn btn-secondary" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
