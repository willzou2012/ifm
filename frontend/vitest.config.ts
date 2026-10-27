import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
        restoreMocks: true,
        unstubGlobals: true,
        coverage: {
          provider: 'v8',
          include: ['src/**/*.{ts,vue}'],
          exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
          reporter: ['text', 'html', 'lcov', 'json-summary'],
          thresholds: {
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
          },
        },
      },
    }),
  ),
)
