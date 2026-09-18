const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PC_AGENT_TOKEN = process.env.PC_AGENT_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PC_AGENT_TOKEN) return res.status(503).json({ error: 'Remote PC bridge is not configured.' })
  if ((req.headers.authorization || '') !== 'Bearer ' + PC_AGENT_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const deviceId = String(req.query?.deviceId || '')
  if (!deviceId) return res.status(400).json({ error: 'deviceId is required.' })

  const response = await fetch(SUPABASE_URL + '/rest/v1/pc_commands?device_id=eq.' + encodeURIComponent(deviceId) + '&status=eq.queued&order=created_at.asc&limit=1', {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY },
  })
  const rows = await response.json().catch(() => [])
  if (!response.ok) return res.status(502).json({ error: 'Could not read PC command queue.' })
  return res.status(200).json({ command: rows[0] || null })
}
