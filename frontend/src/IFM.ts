import { createApp, type App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useIfmStore } from './stores/ifm'

export interface IfmParams {
  /** URL of the IFM backend; defaults to the current page without hash */
  api?: string
}

/**
 * Public entry point, compatible with the previous jQuery implementation:
 *
 *     var ifm = new IFM({ api: "ifm.php" });
 *     ifm.init("ifm");
 */
export class IFM {
  readonly api: string
  private app: VueApp | null = null

  constructor(params: IfmParams = {}) {
    this.api = params.api || window.location.href.replace(/#.*/, '')
  }

  /** Mounts the application into the element with the given id. */
  init(id: string): void {
    const el = document.getElementById(id)
    if (!el) throw new Error(`IFM: element #${id} not found`)
    const pinia = createPinia()
    this.app = createApp(App)
    this.app.use(pinia)
    useIfmStore(pinia).setApiUrl(this.api)
    this.app.mount(el)
  }

  /** Unmounts the application. */
  destroy(): void {
    this.app?.unmount()
    this.app = null
  }
}
