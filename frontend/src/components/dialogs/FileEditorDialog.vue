<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import BaseModal from '../BaseModal.vue'
import { useIfmStore } from '@/stores/ifm'
import { getAce, modeForPath, type AceEditor } from '@/utils/ace'

const props = defineProps<{ filename: string; content: string; isNew: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useIfmStore()

const filename = ref(props.filename)
/** name the file is stored under; null while a new file was never saved */
const savedName = ref<string | null>(props.isNew ? null : props.filename)
const taken = ref(false)
const fileChanged = ref(false)
const fullscreen = ref(false)
const showOptions = ref(false)
const editorEl = ref<HTMLElement>()
let editor: AceEditor | null = null

const options = reactive({
  wordwrap: false,
  invisibleChars: false,
  softTabs: true,
  tabSize: 4,
  mode: 'ace/mode/text',
})

function checkFilename(): boolean {
  const value = filename.value
  taken.value = value !== savedName.value && store.fileNames.includes(value)
  return !taken.value
}

function onFilenameInput() {
  if (taken.value) checkFilename()
}

function save() {
  if (!checkFilename() || !editor) return
  void store.saveFile(filename.value, editor.getValue())
  savedName.value = filename.value
  fileChanged.value = false
}

/** Backdrop clicks and Escape must not discard unsaved changes. */
function canDismiss(): boolean {
  if (fileChanged.value) {
    store.log('Prevented closing modal because the file was changed and no button was clicked.')
    return false
  }
  return true
}

function toggleOptions() {
  if (!showOptions.value && editor) {
    const session = editor.getSession()
    options.wordwrap = session.getOption('wrap') !== 'off' && session.getOption('wrap') !== false
    options.invisibleChars = !!editor.getOption('showInvisibles')
    options.softTabs = !!session.getOption('useSoftTabs')
    options.tabSize = Number(session.getOption('tabSize'))
    options.mode = session.$modeId ?? 'ace/mode/text'
  }
  showOptions.value = !showOptions.value
}

watch(
  () => options.wordwrap,
  (v) => editor?.getSession().setOption('wrap', v),
)
watch(
  () => options.invisibleChars,
  (v) => editor?.setOption('showInvisibles', v),
)
watch(
  () => options.softTabs,
  (v) => editor?.getSession().setOption('useSoftTabs', v),
)
watch(
  () => options.tabSize,
  (v) => editor?.getSession().setOption('tabSize', v),
)

function setMode(mode: string) {
  options.mode = mode
  editor?.getSession().setMode(mode)
}

onMounted(() => {
  const ace = getAce()
  if (!ace || !editorEl.value) {
    store.notify(store.t('file_display_error'), 'e')
    return
  }
  editor = ace.edit(editorEl.value)
  editor.getSession().setValue(props.content)
  editor.focus()
  editor.on('change', () => (fileChanged.value = true))
  if (store.aceFiles.includes('ext-modelist')) {
    const mode = modeForPath(ace, props.filename)
    if (mode && store.aceModes.map((x) => `ace/mode/${x}`).includes(mode))
      editor.getSession().setMode(mode)
  }
  editor.commands.addCommand({
    name: 'toggleFullscreen',
    bindKey: 'Ctrl-Shift-F',
    exec: (e) => {
      fullscreen.value = !fullscreen.value
      // resize after the DOM reflected the new size
      setTimeout(() => {
        e.resize()
        e.focus()
      })
    },
  })
})

onBeforeUnmount(() => editor?.destroy())

defineExpose({ save, canDismiss })
</script>

<template>
  <BaseModal large :can-dismiss="canDismiss" @close="emit('close')">
    <form id="formFile" @submit.prevent>
      <div class="modal-body">
        <fieldset>
          <div class="form-group">
            <label for="filename">{{ store.t('filename') }}:</label>
            <input
              id="filename"
              v-model="filename"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': taken }"
              name="filename"
              @input="onFilenameInput"
            />
            <div id="filenameError" class="invalid-feedback">
              {{ taken ? store.t('name_already_exists') : '' }}
            </div>
          </div>
          <div
            id="content"
            ref="editorEl"
            class="form-group"
            :class="{ 'ifm-editor-fullscreen': fullscreen }"
          />
          <div class="position-relative d-inline-block">
            <button
              id="editoroptions"
              type="button"
              class="btn btn-secondary"
              :aria-expanded="showOptions"
              @click="toggleOptions"
            >
              {{ store.t('editor_options') }}
            </button>
            <div
              v-if="showOptions"
              class="popover bs-popover-bottom ifm-editor-options"
              role="tooltip"
            >
              <div class="arrow" />
              <h3 class="popover-header">{{ store.t('options') }}</h3>
              <div class="popover-body">
                <div class="form-group">
                  <div class="custom-control custom-switch">
                    <input
                      id="editor-wordwrap"
                      v-model="options.wordwrap"
                      class="custom-control-input"
                      type="checkbox"
                    />
                    <label class="custom-control-label" for="editor-wordwrap">
                      {{ store.t('word_wrap') }}
                    </label>
                  </div>
                  <div class="custom-control custom-switch">
                    <input
                      id="editor-invisible-chars"
                      v-model="options.invisibleChars"
                      class="custom-control-input"
                      type="checkbox"
                    />
                    <label class="custom-control-label" for="editor-invisible-chars">
                      {{ store.t('invisible_chars') }}
                    </label>
                  </div>
                  <div class="custom-control custom-switch">
                    <input
                      id="editor-softtabs"
                      v-model="options.softTabs"
                      class="custom-control-input"
                      type="checkbox"
                    />
                    <label class="custom-control-label" for="editor-softtabs">
                      {{ store.t('soft_tabs') }}
                    </label>
                  </div>
                </div>
                <div class="input-group">
                  <div class="input-group-prepend">
                    <span id="editor-tabsize-label" class="input-group-text">
                      {{ store.t('tab_size') }}
                    </span>
                  </div>
                  <input
                    id="editor-tabsize"
                    v-model.number="options.tabSize"
                    class="form-control"
                    type="number"
                    min="1"
                    max="9"
                    :title="store.t('tab_size')"
                    aria-describedby="editor-tabsize-label"
                  />
                </div>
                <select
                  v-if="store.aceModes.length > 0"
                  id="editor-syntax"
                  class="form-control mt-2"
                  :value="options.mode"
                  @change="setMode(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="mode in store.aceModes" :key="mode" :value="`ace/mode/${mode}`">
                    {{ mode }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button id="buttonSaveNotClose" type="button" class="btn btn-success" @click="save">
          {{ store.t('save') }}
        </button>
        <button id="buttonClose" type="button" class="btn btn-danger" @click="emit('close')">
          {{ store.t('close') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
