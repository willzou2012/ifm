<script setup lang="ts">
import { useIfmStore } from '@/stores/ifm'

const store = useIfmStore()
// IFM_VERSION is replaced with the actual version by compiler.php
const version = 'IFM_VERSION'
</script>

<template>
  <div class="container">
    <div class="card ifminfo">
      <div class="card-body p-2">
        <div class="ifminfo-footer-text">
          {{ store.t('footer') }}
          <a
            :href="`https://github.com/misterunknown/ifm/releases/tag/${version}`"
            target="_blank"
            >{{ version }}</a
          >
        </div>
        <a
          class="ifminfo-github-link"
          href="https://github.com/misterunknown/ifm"
          target="_blank"
          :title="store.t('github')"
        >
          <span class="icon fa fa-github" />
        </a>
      </div>
    </div>
  </div>
</template>
