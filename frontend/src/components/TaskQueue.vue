<script setup lang="ts">
import { ref, watch } from 'vue'
import { useIfmStore } from '@/stores/ifm'

const store = useIfmStore()
const expanded = ref(false)

// leave room for the fixed footer at the bottom of the page
watch(
  () => store.tasks.length > 0,
  (visible) => (document.body.style.paddingBottom = visible ? '9rem' : ''),
  { immediate: true },
)
</script>

<template>
  <footer v-if="store.tasks.length > 0" class="footer mt-auto py-3">
    <div id="wq_container" class="container">
      <div class="row">
        <div class="col-md-2 mb-1">
          <button
            type="button"
            class="btn btn-light btn-block"
            name="showAll"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ store.t('tasks') }}
            <span class="badge badge-secondary" name="taskCount">{{ store.tasks.length }}</span>
          </button>
        </div>
        <div id="waitqueue" class="col-md-10" :class="{ expanded }">
          <div v-for="task in store.tasks" :id="`wq-${task.id}`" :key="task.id" class="card mb-1">
            <div class="card-body">
              <div class="progress">
                <div
                  class="progress-bar task-progress-bar progress-bar-striped progress-bar-animated"
                  :class="`bg-${task.type}`"
                  role="progressbar"
                  :style="{ width: `${task.progress}%` }"
                  :aria-valuenow="task.progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {{ task.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
