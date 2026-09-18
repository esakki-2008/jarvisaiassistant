import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

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
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Missing device authentication.' })

    const db = admin()
    const tokenHash = hashToken(token)
    const { data: device, error: deviceError } = await db
      .from('pc_devices')
      .select('id,device_name,enabled')
      .eq('device_token_hash', tokenHash)
      .maybeSingle()

    if (deviceError) throw deviceError
    if (!device || !device.enabled) return res.status(401).json({ error: 'Device is not authorized.' })

    await db.from('pc_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)

    const { data: command, error: commandError } = await db
      .from('pc_commands')
      .select('id,action,value')
      .eq('device_id', device.id)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (commandError) throw commandError
    if (!command) return res.status(200).json({ command: null })

    const { error: claimError } = await db
      .from('pc_commands')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', command.id)
      .eq('status', 'queued')

    if (claimError) throw claimError
    return res.status(200).json({ command })
  } catch (error) {
    console.error('PC poll error:', error)
    return res.status(500).json({ error: 'PC polling failed.' })
  }
}
