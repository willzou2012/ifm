import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The build produces a single IIFE script plus one stylesheet, which
// compiler.php inlines into the single-file PHP distribution. Bootstrap,
// Font Awesome and Ace are not bundled; the PHP page provides them (inlined
// or from a CDN), see src/assets*.{js,css}.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define:
    command === 'build'
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
          __VUE_OPTIONS_API__: 'false',
          __VUE_PROD_DEVTOOLS__: 'false',
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        }
      : {},
  // vendored Bootstrap, Font Awesome and Ace for the development server only
  publicDir: fileURLToPath(new URL('../src/includes', import.meta.url)),
  build: {
    target: 'es2020',
    copyPublicDir: false,
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['iife'],
      name: 'IFMBundle',
      fileName: () => 'ifm.min.js',
      cssFileName: 'ifm.min',
    },
  },
  server: {
    // `npm run dev` serves index.html and proxies API calls to a PHP backend
    // running a compiled ifm.php on port 8080 (see frontend/README.md).
    fs: { allow: ['..'] },
    proxy: {
      '/ifm.php': process.env.IFM_BACKEND ?? 'http://127.0.0.1:8080',
    },
  },
}))
