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

    const { pairingId, code, deviceName } = req.body || {}
    if (!/^\d{6}$/.test(String(code || '')) || !deviceName) {
      return res.status(400).json({ error: 'A six-digit code and deviceName are required.' })
    }

    const db = admin()
    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex')

    let requestQuery = db
      .from('pc_pairing_requests')
      .select('id,code_hash,expires_at,used,created_at')

    if (pairingId) {
      requestQuery = requestQuery.eq('id', pairingId).limit(1)
    } else {
      requestQuery = requestQuery
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(20)
    }

    const { data: requestRows, error: lookupError } = await requestQuery
    if (lookupError) throw lookupError

    const requests = Array.isArray(requestRows) ? requestRows : requestRows ? [requestRows] : []
    const request = requests.find(
      (item) =>
        !item.used &&
        item.expires_at >= new Date().toISOString() &&
        item.code_hash === codeHash,
    )

    if (!request) {
      return res.status(400).json({ error: 'Pairing code is invalid or expired.' })
    }

    const token = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: device, error: deviceError } = await db
      .from('pc_devices')
      .insert({
        device_name: String(deviceName).slice(0, 100),
        device_token_hash: tokenHash,
      })
      .select('id,device_name')
      .single()

    if (deviceError) throw deviceError

    const { error: markError } = await db
      .from('pc_pairing_requests')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        device_id: device.id,
      })
      .eq('id', request.id)

    if (markError) throw markError

    return res.status(200).json({
      deviceId: device.id,
      deviceToken: token,
      deviceName: device.device_name,
    })
  } catch (error) {
    console.error('Pair complete error:', error)
    return res.status(500).json({ error: 'Could not complete secure PC pairing.' })
  }
}
