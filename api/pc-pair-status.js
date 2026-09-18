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
    if (!token) return res.status(401).json({ error: 'Missing pairing authentication.' })

    const db = admin()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const { data: request, error } = await db
      .from('pc_pairing_requests')
      .select('id,expires_at,used,device_id')
      .eq('client_token_hash', tokenHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!request) return res.status(404).json({ error: 'Pairing request not found.' })

    let deviceName = null
    if (request.device_id) {
      const { data: device, error: deviceError } = await db
        .from('pc_devices')
        .select('device_name,enabled')
        .eq('id', request.device_id)
        .maybeSingle()
      if (deviceError) throw deviceError
      if (device?.enabled) deviceName = device.device_name
    }

    return res.status(200).json({
      paired: Boolean(request.used && request.device_id && deviceName),
      expired: !request.used && new Date(request.expires_at).getTime() <= Date.now(),
      deviceName,
      expiresAt: request.expires_at,
    })
  } catch (error) {
    console.error('Pair status error:', error)
    return res.status(500).json({ error: 'Could not check pairing status.' })
  }
}
