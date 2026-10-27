<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import FolderTreeNode from '../FolderTreeNode.vue'
import { useIfmStore } from '@/stores/ifm'
import type { FileItem, FolderNode } from '@/types'

const props = defineProps<{ items: FileItem[] }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const nodes = ref<FolderNode[] | null>(null)
const selectedPath = ref<string | null>(null)

onMounted(async () => {
  try {
    nodes.value = await store.getFolders()
  } catch {
    emit('close')
    store.notify(store.t('folder_tree_load_error'), 'e')
  }
})

function run(action: 'copy' | 'move') {
  if (selectedPath.value === null) return
  void store.copyMove(props.items, selectedPath.value, action)
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="formCopyMove" @submit.prevent>
      <fieldset>
        <div class="modal-body">
          <div class="form-group">
            <label for="copyMoveTree">{{ store.t('select_destination') }}:</label>
            <div id="copyMoveTree" class="treeview">
              <div v-if="nodes === null" class="text-center">
                <span class="icon fa fa-spinner fa-spin" />
              </div>
              <ul v-else class="list-group">
                <FolderTreeNode
                  v-for="node in nodes"
                  :key="node.dataAttr.path"
                  :node="node"
                  :level="0"
                  :selected-path="selectedPath"
                  :load-children="store.getFolders"
                  @select="selectedPath = $event"
                />
              </ul>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            id="copyButton"
            type="button"
            class="btn btn-secondary"
            :disabled="selectedPath === null"
            @click="run('copy')"
          >
            {{ store.t('copy') }}
          </button>
          <button
            id="moveButton"
            type="button"
            class="btn btn-secondary"
            :disabled="selectedPath === null"
            @click="run('move')"
          >
            {{ store.t('move') }}
          </button>
          <button id="cancelButton" type="button" class="btn btn-danger" @click="emit('close')">
            {{ store.t('cancel') }}
          </button>
        </div>
      </fieldset>
    </form>
  </BaseModal>
</template>
