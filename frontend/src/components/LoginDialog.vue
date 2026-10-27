<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { sanitizeHtml } from '@/utils/html'

const store = useIfmStore()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = (await store.login(username.value, password.value)) ?? ''
  busy.value = false
}
</script>

<template>
  <BaseModal large static>
    <div class="modal-header">
      <h3 class="modal-title text-center w-100">IFM {{ store.t('login') }}</h3>
    </div>
    <div class="modal-body">
      <form id="loginForm" class="form-signin" method="post" @submit.prevent="submit">
        <div class="form-label-group">
          <span class="fa fa-user-circle fa-fw input-icon" />
          <input
            id="inputLogin"
            v-model="username"
            type="text"
            name="inputLogin"
            class="form-control"
            :placeholder="store.t('username')"
            required
            autofocus
          />
          <label for="inputLogin">{{ store.t('username') }}</label>
        </div>
        <div class="form-label-group">
          <span class="fa fa-key fa-fw input-icon" />
          <input
            id="inputPassword"
            v-model="password"
            type="password"
            name="inputPassword"
            class="form-control"
            :placeholder="store.t('password')"
            required
          />
          <label for="inputPassword">{{ store.t('password') }}</label>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -- sanitized -->
        <div v-if="error" class="alert alert-danger" role="alert" v-html="sanitizeHtml(error)" />
        <button
          id="buttonLogin"
          class="btn btn-lg btn-primary btn-block"
          type="submit"
          :disabled="busy"
        >
          {{ store.t('login') }}
        </button>
      </form>
    </div>
  </BaseModal>
</template>
