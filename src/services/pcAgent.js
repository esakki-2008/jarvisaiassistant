import { getPcClientToken } from './pcPairing'

const LOCAL_PC_AGENT_URL = 'http://127.0.0.1:8787'
const REMOTE_PC_API = '/api/pc-command'

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'JARVIS PC service request failed.')
  return data
}

export async function pcAgentStatus() {
  try {
    const response = await fetch(`${LOCAL_PC_AGENT_URL}/status`)
    if (!response.ok) throw new Error()
    return response.json()
  } catch {
    return { ok: false, agent: 'JARVIS PC Agent', remote: false }
  }
}

export async function executePcAction(action, value) {
  const local = await pcAgentStatus()
  if (local.ok) {
    const data = await jsonFetch(`${LOCAL_PC_AGENT_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value }),
    })
    return data.message
  }

  const clientToken = getPcClientToken()
  if (!clientToken) {
    throw new Error('JARVIS PC pairing is not authorized in this browser. Click PAIR PC in this browser first.')
  }

  const data = await jsonFetch(REMOTE_PC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + clientToken,
    },
    body: JSON.stringify({ action, value }),
  })
  return data.message || 'Command queued for your paired PC.'
}

export function detectPcAction(message) {
  const text = message.trim()
  const lower = text.toLowerCase()

  const apps = [['google chrome','chrome'],['chrome','chrome'],['microsoft edge','edge'],['edge','edge'],['visual studio code','vscode'],['vs code','vscode'],['vscode','vscode'],['notepad','notepad'],['file explorer','explorer'],['explorer','explorer'],['powershell','powershell']]
  if (/^(open|launch|start|run)\s+/i.test(text)) {
    const match = apps.find(([alias]) => lower.includes(alias))
    if (match) return { action:'open_app', value:match[1] }
  }

  const sites = [['youtube','https://www.youtube.com'],['google','https://www.google.com'],['github','https://github.com'],['gmail','https://mail.google.com'],['chatgpt','https://chatgpt.com']]
  if (/^(open|launch|visit|go to)\s+/i.test(text)) {
    const site = sites.find(([name]) => lower.includes(name))
    if (site) return { action:'open_url', value:site[1] }
  }

  const folders = ['desktop','downloads','documents']
  const folder = folders.find(item => lower.includes(item))
  if (folder && /\b(open|show|go to|access)\b/i.test(text)) return { action:'open_path', value:folder }

  const urlMatch = text.match(/https?:\/\/\S+/i)
  if (urlMatch && /\b(open|visit|go to)\b/i.test(text)) return { action:'open_url', value:urlMatch[0] }

  const typeMatch = text.match(/^(?:type|write|enter)\s+(.+)$/i)
  if (typeMatch) return { action:'type_text', value:typeMatch[1] }

  const hotkey = text.match(/^(?:press|use)\s+(?:hotkey\s+)?(ctrl|control|alt|shift|win)\s*\+\s*([a-z0-9]+)(?:\s*\+\s*([a-z0-9]+))?(?:\s*\+\s*([a-z0-9]+))?$/i)
  if (hotkey) return { action:'hotkey', value:[hotkey[1],hotkey[2],hotkey[3],hotkey[4]].filter(Boolean).join('+') }

  const key = text.match(/^(?:press|hit)\s+(enter|tab|escape|esc|space|backspace|delete|home|end|pageup|pagedown|up|down|left|right|f1|f2|f3|f4|f5|f6|f7|f8|f9|f10|f11|f12)$/i)
  if (key) return { action:'key_press', value:key[1] }

  if (/^(?:click|left click)(?: the mouse)?$/i.test(text)) return { action:'mouse_click', value:'left' }
  if (/^right click(?: the mouse)?$/i.test(text)) return { action:'mouse_click', value:'right' }
  if (/^(?:double click|double-click)(?: the mouse)?$/i.test(text)) return { action:'mouse_click', value:'double' }

  const move = text.match(/^(?:move mouse to|move the mouse to)\s*(\d+)\s*[, ]\s*(\d+)$/i)
  if (move) return { action:'mouse_move', value:`${move[1]},${move[2]}` }

  return null
}
