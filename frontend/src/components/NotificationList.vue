<script setup lang="ts">
import { useIfmStore } from '@/stores/ifm'
import NotificationItem from './NotificationItem.vue'

const store = useIfmStore()
// while a dialog is open the notifications are raised to keep its footer buttons uncovered
</script>

<template>
  <div
    class="ifm-notifications"
    :class="{ 'ifm-notifications-raised': store.dialog }"
    aria-live="polite"
  >
    <NotificationItem
      v-for="n in store.notifications"
      :key="n.id"
      :notification="n"
      @dismiss="store.dismiss"
    />
  </div>
</template>
