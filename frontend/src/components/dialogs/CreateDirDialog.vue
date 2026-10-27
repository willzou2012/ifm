<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'

const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const dirname = ref('')
const taken = ref(false)

function checkDirname(): boolean {
  taken.value = store.fileNames.includes(dirname.value)
  return !taken.value
}

function onInput() {
  if (taken.value) checkDirname()
}

function submit() {
  if (!checkDirname()) return
  void store.createDir(dirname.value)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formCreateDir" @submit.prevent="submit">
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="dirname">{{ store.t('directoryname') }}:</label>
            <input
              id="dirname"
              v-model="dirname"
              class="form-control"
              :class="{ 'is-invalid': taken }"
              type="text"
              name="dirname"
              autofocus
              @input="onInput"
            />
            <div id="dirnameError" class="invalid-feedback">
              {{ taken ? store.t('name_already_exists') : '' }}
            </div>
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonSave" type="submit" class="btn btn-success">
          {{ store.t('create') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
