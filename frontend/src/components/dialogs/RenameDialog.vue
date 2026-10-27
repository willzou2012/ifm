<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'

const props = defineProps<{ filename: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const newname = ref(props.filename)

function submit() {
  void store.renameFile(props.filename, newname.value)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formRenameFile" @submit.prevent="submit">
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="newname">{{ store.t('rename_filename') }} {{ filename }}:</label>
            <input
              id="newname"
              v-model="newname"
              class="form-control"
              type="text"
              name="newname"
              autofocus
            />
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonRename" type="submit" class="btn btn-secondary">
          {{ store.t('file_rename') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
