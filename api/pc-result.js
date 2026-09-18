import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured on the server.')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Missing device authentication.' })

    const { commandId, ok, message, error: actionError } = req.body || {}
    if (!commandId) return res.status(400).json({ error: 'commandId is required.' })

    const db = admin()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const { data: device } = await db.from('pc_devices').select('id,enabled').eq('device_token_hash', tokenHash).maybeSingle()
    if (!device || !device.enabled) return res.status(401).json({ error: 'Device is not authorized.' })

    const { error } = await db.from('pc_commands')
      .update({
        status: ok ? 'completed' : 'failed',
        result: String(ok ? message || 'Completed.' : actionError || 'PC action failed.').slice(0, 4000),
        completed_at: new Date().toISOString(),
      })
      .eq('id', commandId)
      .eq('device_id', device.id)
      .eq('status', 'claimed')

    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('PC result error:', error)
    return res.status(500).json({ error: 'Could not save PC action result.' })
  }
}
