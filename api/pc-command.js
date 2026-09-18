import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ACTIONS = new Set([
  'open_app',
  'open_path',
  'open_url',
  'type_text',
  'key_press',
  'hotkey',
  'mouse_move',
  'mouse_click',
])

function admin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured on the server.')
  return createClient(url, key, { auth: { persistSession: false } })
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const clientToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!clientToken) return res.status(401).json({ error: 'JARVIS PC pairing is not authorized in this browser.' })

    const { action, value } = req.body || {}
    if (!ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Unsupported or unsafe PC action.' })
    }

    const db = admin()
    const clientTokenHash = hashToken(clientToken)
    const { data: pairing, error: pairingError } = await db
      .from('pc_pairing_requests')
      .select('id,device_id,used,expires_at')
      .eq('client_token_hash', clientTokenHash)
      .eq('used', true)
      .maybeSingle()

    if (pairingError) throw pairingError
    if (!pairing?.device_id) return res.status(409).json({ error: 'No paired PC is associated with this JARVIS browser.' })

    // The browser never receives the PC device token.
    // The active device is selected server-side from the paired-device record.
    // For the first single-PC version, exactly one enabled device is accepted.
    const { data: devices, error: deviceError } = await db
      .from('pc_devices')
      .select('id,device_name,last_seen_at')
      .eq('id', pairing.device_id)
      .eq('enabled', true)

    if (deviceError) throw deviceError
    if (!devices?.length) {
      return res.status(409).json({ error: 'No JARVIS PC is paired yet.' })
    }
    const device = devices[0]

    const safeValue = value == null ? null : String(value).slice(0, 1000)

    const { data: command, error: commandError } = await db
      .from('pc_commands')
      .insert({
        device_id: device.id,
        action,
        value: safeValue,
        status: 'queued',
      })
      .select('id,action,value,created_at')
      .single()

    if (commandError) throw commandError

    return res.status(200).json({
      ok: true,
      queued: true,
      commandId: command.id,
      deviceName: device.device_name,
      message: 'Command queued for ' + device.device_name + '.',
    })
  } catch (error) {
    console.error('PC command error:', error)
    return res.status(500).json({ error: 'Could not queue the PC command.' })
  }
}
