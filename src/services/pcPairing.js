const CLIENT_TOKEN_KEY = 'jarvis-pc-client-token-v1'
const PAIRING_KEY = 'jarvis-pc-pairing-v1'

export function getPcClientToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(CLIENT_TOKEN_KEY) || ''
}

export function getPairing() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.localStorage.getItem(PAIRING_KEY) || 'null') } catch { return null }
}

async function post(path, body, token = '') {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'PC pairing request failed.')
  return data
}

export async function startPcPairing() {
  const data = await post('/api/pc-pair-start', {})
  window.localStorage.setItem(CLIENT_TOKEN_KEY, data.clientToken)
  window.localStorage.setItem(PAIRING_KEY, JSON.stringify({ pairingId: data.pairingId, code: data.code, expiresAt: data.expiresAt }))
  return data
}

export async function completePcPairing(pairingId, code, deviceName) {
  return post('/api/pc-pair-complete', { pairingId, code, deviceName })
}

export async function getPcPairingStatus() {
  const token = getPcClientToken()
  if (!token) return { paired: false, expired: false, deviceName: null }
  try {
    return await post('/api/pc-pair-status', {}, token)
  } catch {
    return { paired: false, expired: false, deviceName: null }
  }
}

export function savePairedDevice(deviceName) {
  const current = getPairing() || {}
  const next = { ...current, deviceName }
  window.localStorage.setItem(PAIRING_KEY, JSON.stringify(next))
  return next
}

export function clearPcPairing() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CLIENT_TOKEN_KEY)
  window.localStorage.removeItem(PAIRING_KEY)
}
