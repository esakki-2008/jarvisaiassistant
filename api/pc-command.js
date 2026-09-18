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

    const { action, value } = req.body || {}
    if (!ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Unsupported or unsafe PC action.' })
    }

    const db = admin()

    // The browser never receives the PC device token.
    // The active device is selected server-side from the paired-device record.
    // For the first single-PC version, exactly one enabled device is accepted.
    const { data: devices, error: deviceError } = await db
      .from('pc_devices')
      .select('id,device_name,last_seen_at')
      .eq('enabled', true)
      .order('last_seen_at', { ascending: false })
      .limit(2)

    if (deviceError) throw deviceError
    if (!devices?.length) {
      return res.status(409).json({ error: 'No JARVIS PC is paired yet.' })
    }
    if (devices.length > 1) {
      return res.status(409).json({ error: 'Multiple PCs are paired. Device selection will be added before remote control is enabled.' })
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
