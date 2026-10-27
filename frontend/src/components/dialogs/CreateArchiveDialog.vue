<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import type { FileItem } from '@/types'

const props = defineProps<{ items: FileItem[] }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const archivename = ref('')

function submit() {
  // the dialog stays open if the name has no valid archive extension
  if (store.createArchive(props.items, archivename.value)) emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formCreateArchive" @submit.prevent="submit">
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="archivename">{{ store.t('archivename') }}:</label>
            <input
              id="archivename"
              v-model="archivename"
              class="form-control"
              type="text"
              name="archivename"
              autofocus
            />
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonSave" type="submit" class="btn btn-success">
          {{ store.t('save') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
