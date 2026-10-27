# IFM frontend

The browser application of IFM, written in [Vue 3](https://vuejs.org/) with
TypeScript, [Pinia](https://pinia.vuejs.org/) for state and
[Vite](https://vite.dev/) as build tool. `npm run build` produces a single
script (`dist/ifm.min.js`) and stylesheet (`dist/ifm.min.css`), which
`compiler.php` inlines into the single-file PHP distribution.

Bootstrap 4 (CSS only), Font Awesome 4 and the Ace editor are not bundled; the
PHP page provides them, inlined from `src/includes` or loaded from a CDN (see
`src/assets*.{js,css}` in the repository root). Ace is used through the global
`window.ace`, so extra Ace modes dropped into `src/includes/ace` keep working.

## Layout

```
src/
  main.ts              bundle entry, exposes window.IFM
  IFM.ts               public API: new IFM({ api }).init(elementId)
  App.vue              application shell (login, navbar, table, dialogs, ...)
  api/client.ts        fetch/XHR client of the PHP JSON API (CSRF handling)
  stores/ifm.ts        Pinia store: config, i18n, files, tasks, dialogs and
                       every file operation
  composables/         file actions + context menu, keyboard shortcuts,
                       table sort/filter/paging state
  components/          UI components; dialogs/ holds one component per dialog
  utils/               framework-free helpers (paths, links, formatting, ...)
  styles/ifm.css       application styles
e2e/                   Playwright tests against the compiled dist/ifm.php
```

## Scripts

| Command                 | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `npm ci`                | install dependencies                                    |
| `npm run dev`           | development server with hot reload (see below)          |
| `npm run build`         | type-check and build `dist/`                            |
| `npm test`              | unit tests (Vitest + Vue Test Utils, jsdom)             |
| `npm run test:coverage` | unit tests with coverage; fails below 80 %              |
| `npm run test:e2e`      | browser tests (Playwright), needs `make build` and PHP  |
| `npm run lint`          | ESLint                                                  |
| `npm run format`        | Prettier                                                |
| `npm run type-check`    | vue-tsc                                                 |

From the repository root, `make frontend`, `make frontend-lint`,
`make frontend-test` and `make test-e2e` wrap these.

## Development server

The dev server serves the app with hot module replacement and proxies API
calls (`/ifm.php`) to a PHP backend, by default `http://127.0.0.1:8080`
(override with `IFM_BACKEND`):

```bash
make build                                  # compile dist/ifm.php once
mkdir -p /tmp/ifm-dev && cp dist/ifm.php /tmp/ifm-dev/
php -S 127.0.0.1:8080 -t /tmp/ifm-dev &     # the backend manages /tmp/ifm-dev
cd frontend && npm run dev                  # open http://localhost:5173
```

## Tests

* **Unit tests** live next to the code in `__tests__` directories. The API is
  faked with `mockBackend()` from `src/__tests__/helpers.ts`, which also
  provides `setupStore()` to start from a configured store.
* **End-to-end tests** (`e2e/`) start the compiled `dist/ifm.php` with PHP's
  built-in server in a fresh sandbox (`e2e/serve.mjs`), once without and once
  with authentication. Set `PHP` to choose the PHP binary:
  `PHP=php8.3 npm run test:e2e`. Install the browser once with
  `npx playwright install chromium`.
