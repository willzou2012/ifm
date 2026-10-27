import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the compiled single-file distribution
 * (../dist/ifm.php, built with `make build`). They need a PHP CLI binary,
 * configurable through the PHP environment variable.
 */
export default defineConfig({
  testDir: './e2e',
  // the tests share one sandbox per server, so they run one after another
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8099',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/serve.mjs',
      url: 'http://127.0.0.1:8099/ifm.php?api=getConfig',
      env: { PORT: '8099' },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      // second instance with authentication enabled (admin / admin)
      command: 'node e2e/serve.mjs',
      url: 'http://127.0.0.1:8098/ifm.php?api=getConfig',
      env: {
        PORT: '8098',
        IFM_AUTH: '1',
        IFM_AUTH_SOURCE: 'inline;admin:$apr1$mS.N6oQx$0wAz/05xVMNvEHPSL2TxS/',
      },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
  ],
})
