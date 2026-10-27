/**
 * Starts the compiled IFM (dist/ifm.php) on PHP's built-in web server, in a
 * fresh sandbox directory populated with fixture files. Used by Playwright's
 * `webServer` option. Configuration via environment:
 *
 *   PHP       PHP binary (default: php)
 *   PORT      port to listen on (default: 8099)
 *   IFM_*     passed through to IFM (e.g. IFM_AUTH=1)
 */
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../../dist/ifm.php')
const port = process.env.PORT ?? '8099'
const sandbox = mkdtempSync(join(tmpdir(), 'ifm-e2e-'))

copyFileSync(dist, join(sandbox, 'ifm.php'))
writeFileSync(join(sandbox, 'readme.txt'), 'Hello from IFM\n')
writeFileSync(join(sandbox, 'data.json'), '{"answer": 42}\n')
writeFileSync(join(sandbox, 'big.log'), 'x'.repeat(4096))
mkdirSync(join(sandbox, 'docs'))
writeFileSync(join(sandbox, 'docs', 'notes.md'), '# Notes\n')
mkdirSync(join(sandbox, 'docs', 'deep'))
writeFileSync(join(sandbox, 'docs', 'deep', 'needle.txt'), 'found me\n')
mkdirSync(join(sandbox, 'target'))
// a 1x1 transparent PNG
writeFileSync(
  join(sandbox, 'pixel.png'),
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  ),
)

const php = process.env.PHP ?? 'php'
const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', sandbox], {
  cwd: sandbox,
  stdio: 'inherit',
  env: { ...process.env, PHP_CLI_SERVER_WORKERS: '4' },
})
console.log(`IFM e2e server on http://127.0.0.1:${port}/ifm.php (sandbox ${sandbox})`)

const stop = () => server.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => process.exit(code ?? 0))
