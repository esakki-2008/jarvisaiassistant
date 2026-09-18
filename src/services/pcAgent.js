const PC_AGENT_URL = 'http://127.0.0.1:8787'

export async function pcAgentStatus() {
  const response = await fetch(`${PC_AGENT_URL}/status`)
  if (!response.ok) throw new Error('JARVIS PC Agent is offline.')
  return response.json()
}

export async function executePcAction(action, value) {
  const response = await fetch(`${PC_AGENT_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, value }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) {
    throw new Error(data?.error || 'PC action failed.')
  }

  return data.message
}

export function detectPcAction(message) {
  const text = message.trim().toLowerCase()

  const appAliases = [
    ['google chrome', 'chrome'],
    ['chrome', 'chrome'],
    ['microsoft edge', 'edge'],
    ['edge', 'edge'],
    ['visual studio code', 'vscode'],
    ['vs code', 'vscode'],
    ['vscode', 'vscode'],
    ['notepad', 'notepad'],
    ['calculator', 'calculator'],
    ['file explorer', 'explorer'],
    ['explorer', 'explorer'],
    ['powershell', 'powershell'],
  ]

  if (/^(open|launch|start|run)\s+/.test(text)) {
    const match = appAliases.find(([alias]) => text.includes(alias))
    if (match) return { action: 'open_app', value: match[1] }
  }

  const websites = [
    ['youtube', 'https://www.youtube.com'],
    ['google', 'https://www.google.com'],
    ['github', 'https://github.com'],
    ['gmail', 'https://mail.google.com'],
    ['chatgpt', 'https://chatgpt.com'],
  ]

  if (/^(open|launch|visit|go to)\s+/.test(text)) {
    const site = websites.find(([name]) => text.includes(name))
    if (site) return { action: 'open_url', value: site[1] }
  }

  const folders = ['desktop', 'downloads', 'documents']
  const folder = folders.find(item => text.includes(item))
  if (folder && /\b(open|show|go to|access)\b/.test(text)) {
    return { action: 'open_path', value: folder }
  }

  const urlMatch = text.match(/https?:\/\/\S+/i)
  if (urlMatch && /\b(open|visit|go to)\b/.test(text)) {
    return { action: 'open_url', value: urlMatch[0] }
  }

  return null
}
