<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { extractTargetSuggestion } from '@/utils/files'

const props = defineProps<{ filename: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const suggestion = computed(() => extractTargetSuggestion(props.filename))
const location = ref('./')
const customLocation = ref('')

function submit() {
  const target = location.value === 'custom' ? customLocation.value : location.value
  void store.extractFile(props.filename, target)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formExtractFile" @submit.prevent="submit">
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label>{{ store.t('extract_filename') }} {{ filename }}:</label>
            <div class="input-group ifm-extract-option">
              <div class="input-group-prepend">
                <div class="input-group-text">
                  <input
                    v-model="location"
                    type="radio"
                    name="extractTargetLocation"
                    value="./"
                    aria-label="Current directory"
                  />
                </div>
              </div>
              <input
                class="form-control ifm-extract-location-input"
                type="text"
                placeholder="Current directory"
                readonly
                @click="location = './'"
              />
            </div>
            <div class="input-group ifm-extract-option">
              <div class="input-group-prepend">
                <div class="input-group-text">
                  <input
                    v-model="location"
                    type="radio"
                    name="extractTargetLocation"
                    :value="`./${suggestion}`"
                    :aria-label="suggestion"
                  />
                </div>
              </div>
              <input
                class="form-control ifm-extract-location-input"
                type="text"
                :placeholder="suggestion"
                readonly
                @click="location = `./${suggestion}`"
              />
            </div>
            <div class="input-group ifm-extract-option">
              <div class="input-group-prepend">
                <div class="input-group-text">
                  <input
                    v-model="location"
                    type="radio"
                    name="extractTargetLocation"
                    value="custom"
                    aria-label="Custom location"
                  />
                </div>
              </div>
              <input
                id="extractCustomLocation"
                v-model="customLocation"
                type="text"
                class="form-control"
                placeholder="Custom location"
                @focus="location = 'custom'"
              />
            </div>
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonExtract" type="submit" class="btn btn-primary">
          {{ store.t('extract') }}
        </button>
        <button id="buttonCancel" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
