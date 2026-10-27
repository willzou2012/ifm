<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { rawRequest } from '@/api/client'

const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const url = ref('')
const method = ref<'GET' | 'POST'>('POST')
const data = ref('')
const response = ref('')
const statusCode = ref<number | null>(null)
const ok = ref(false)

async function request() {
  const body = method.value === 'POST' ? data.value.replace(/\n/g, '&') : ''
  const res = await rawRequest(url.value, method.value, body, store.api.csrfToken)
  response.value = res.body
  statusCode.value = res.status
  ok.value = res.ok
  if (!res.ok) store.log(res)
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formAjaxRequest" @submit.prevent>
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="ajaxurl">URL</label>
            <input
              id="ajaxurl"
              v-model="url"
              class="form-control"
              type="url"
              name="ajaxurl"
              placeholder="https://..."
              autocomplete="off"
              autofocus
              required
            />
          </div>
          <div class="form-group">
            <legend>{{ store.t('method') }}</legend>
            <div class="form-check form-check-inline">
              <input
                id="radioget"
                v-model="method"
                class="form-check-input"
                type="radio"
                name="arMethod"
                value="GET"
              />
              <label class="form-check-label" for="radioget">GET</label>
            </div>
            <div class="form-check form-check-inline">
              <input
                id="radiopost"
                v-model="method"
                class="form-check-input"
                type="radio"
                name="arMethod"
                value="POST"
              />
              <label class="form-check-label" for="radiopost">POST</label>
            </div>
          </div>
          <div v-if="method === 'POST'" id="ajaxDataContainer" class="form-group">
            <label for="ajaxdata">{{ store.t('data') }}</label>
            <textarea id="ajaxdata" v-model="data" class="form-control" name="ajaxdata" rows="4" />
          </div>
          <button id="buttonRequest" type="button" class="btn btn-success" @click="request">
            {{ store.t('request') }}
          </button>
          <div class="form-group mt-3">
            <label for="ajaxresponse">
              {{ store.t('response') }}
              <span
                v-if="statusCode !== null"
                id="ajaxStatusCode"
                class="badge"
                :class="ok ? 'badge-success' : 'badge-danger'"
                >{{ statusCode }}</span
              >
            </label>
            <textarea
              id="ajaxresponse"
              class="form-control"
              name="ajaxresponse"
              rows="6"
              readonly
              :value="response"
            />
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonClose" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('cancel') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
