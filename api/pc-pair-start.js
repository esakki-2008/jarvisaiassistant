import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured on the server.')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    const clientToken = crypto.randomBytes(32).toString('base64url')
    const clientTokenHash = crypto.createHash('sha256').update(clientToken).digest('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const db = supabaseAdmin()

    const { data, error } = await db
      .from('pc_pairing_requests')
      .insert({ code_hash: codeHash, client_token_hash: clientTokenHash, expires_at: expiresAt })
      .select('id,expires_at')
      .single()

    if (error) throw error
    return res.status(200).json({ pairingId: data.id, code, clientToken, expiresAt })
  } catch (error) {
    console.error('Pair start error:', error)
    return res.status(500).json({ error: 'Could not start secure PC pairing.' })
  }
}
