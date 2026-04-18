/**
 * Free dev ports. On Windows, netstat can list stale PIDs; prefer Get-NetTCPConnection
 * when available, then fall back to netstat + taskkill.
 */
import { execSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { platform } from 'node:process'

// Free the Vite port and both common API ports (8001 may be stuck/zombie on Windows).
const ports = [8010, 8001, 5173]
const rounds = 6

function killWindowsNetstat(port) {
  let out = ''
  try {
    out = execSync(`cmd /c netstat -ano | findstr ":${port} "`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return
  }
  const pids = new Set()
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue
    const parts = line.trim().split(/\s+/)
    const pid = parts[parts.length - 1]
    if (/^\d+$/.test(pid)) pids.add(pid)
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' })
      console.error(`Stopped PID ${pid} (port ${port})`)
    } catch {
      /* ignore */
    }
  }
}

function killWindowsPs(port) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'pipe' }
    )
  } catch {
    /* ignore */
  }
}

function killWindows(port) {
  killWindowsPs(port)
  killWindowsNetstat(port)
}

function killUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, { shell: '/bin/sh' })
  } catch {
    /* ignore */
  }
}

for (let i = 0; i < rounds; i++) {
  for (const port of ports) {
    if (platform === 'win32') killWindows(port)
    else killUnix(port)
  }
  if (i < rounds - 1) await delay(400)
}
