import http from 'node:http'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const HOST = '127.0.0.1'
const PORT = Number(process.env.JARVIS_PC_AGENT_PORT || 8787)

const allowedApps = {
  chrome: 'chrome',
  edge: 'msedge',
  vscode: 'code',
  notepad: 'notepad',
  calculator: 'calc',
  explorer: 'explorer',
  powershell: 'powershell',
}

const allowedPaths = {
  desktop: path.join(os.homedir(), 'Desktop'),
  downloads: path.join(os.homedir(), 'Downloads'),
  documents: path.join(os.homedir(), 'Documents'),
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(body))
}

function launch(command, args = []) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()
}

function execute(action, value) {
  if (action === 'open_app') {
    const command = allowedApps[String(value || '').toLowerCase()]
    if (!command) throw new Error('That application is not in the safe app allowlist.')
    launch(command)
    return `Opening ${String(value).toLowerCase()}.`
  }

  if (action === 'open_path') {
    const target = allowedPaths[String(value || '').toLowerCase()]
    if (!target) throw new Error('That folder is not in the safe path allowlist.')
    launch('explorer.exe', [target])
    return `Opening ${String(value).toLowerCase()}.`
  }

  if (action === 'open_url') {
    const url = String(value || '').trim()
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https URLs are allowed.')
    launch('cmd.exe', ['/c', 'start', '', url])
    return 'Opening the requested website.'
  }

  throw new Error('Unsupported PC action.')
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})

  if (req.method === 'GET' && req.url === '/status') {
    return json(res, 200, {
      ok: true,
      agent: 'JARVIS PC Agent',
      platform: process.platform,
      host: HOST,
      port: PORT,
    })
  }

  if (req.method !== 'POST' || req.url !== '/execute') {
    return json(res, 404, { error: 'Not found' })
  }

  let body = ''
  req.on('data', chunk => {
    body += chunk
    if (body.length > 8192) req.destroy()
  })

  req.on('end', () => {
    try {
      const { action, value } = JSON.parse(body || '{}')
      const message = execute(action, value)
      return json(res, 200, { ok: true, message })
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message })
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`JARVIS PC Agent listening on http://${HOST}:${PORT}`)
  console.log('Safe actions: open_app, open_path, open_url')
})
