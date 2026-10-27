<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import type { SearchResult } from '@/types'
import { pathCombine } from '@/utils/path'

const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const pattern = ref(store.lastSearch)
const searching = ref(false)

async function search() {
  if (!pattern.value || pattern.value.trim() === '') return
  searching.value = true
  const ok = await store.searchItems(pattern.value)
  searching.value = false
  if (!ok) emit('close')
}

function open(result: SearchResult) {
  void store.changeDirectory(pathCombine(store.searchDir, result.folder), { absolute: true })
  emit('close')
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form id="searchForm" @submit.prevent="search">
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="searchPattern">{{ store.t('search') }}</label>
            <div class="input-group">
              <input
                id="searchPattern"
                v-model="pattern"
                type="search"
                class="form-control"
                name="pattern"
                autocomplete="off"
                autofocus
              />
              <div class="input-group-append">
                <button id="buttonSearch" class="btn btn-primary" type="submit">
                  <span class="fa fa-search" />
                </button>
              </div>
            </div>
          </div>
          <div class="search-results-container">
            <table id="searchResults" class="table">
              <tbody>
                <tr v-if="searching">
                  <td class="text-center"><span class="icon fa fa-spinner fa-spin" /></td>
                </tr>
                <template v-else-if="store.searchResults">
                  <tr
                    v-for="item in store.searchResults"
                    :key="item.guid"
                    :data-filename="item.name"
                  >
                    <td>
                      <a
                        :id="item.guid"
                        tabindex="0"
                        class="searchitem"
                        :data-type="item.type"
                        :data-folder="item.folder"
                        @click.prevent="open(item)"
                        @keypress.enter.prevent="open(item)"
                      >
                        <span :class="item.icon" /> {{ item.linkname }}
                        <span class="search-folder-path">({{ item.folder }})</span>
                      </a>
                    </td>
                  </tr>
                  <tr v-if="store.searchResults.length === 0">
                    <td>No results found.</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </fieldset>
      </div>
    </form>
  </BaseModal>
</template>
