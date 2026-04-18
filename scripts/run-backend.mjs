/**
 * Start uvicorn with backend/.venv when present so deps match (Windows Store Python vs venv).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const backend = join(root, 'backend')
const winPy = join(backend, '.venv', 'Scripts', 'python.exe')
const unixPy = join(backend, '.venv', 'bin', 'python')
const py = existsSync(winPy) ? winPy : existsSync(unixPy) ? unixPy : 'python'

const port = process.env.TC_API_PORT || '8010'

// Avoid --reload on Windows: uvicorn's reloader can serve a stale/partial app (truncated
// OpenAPI, missing admin routes) while /health still works. Use `npm run restart:dev` after edits.
// Opt in: UVICORN_RELOAD=1
const reload = process.env.UVICORN_RELOAD === '1'

const args = [
  '-m',
  'uvicorn',
  'app.main:app',
  '--host',
  '127.0.0.1',
  '--port',
  port,
  ...(reload ? ['--reload'] : []),
]

const child = spawn(py, args, {
  cwd: backend,
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => process.exit(code ?? 0))
