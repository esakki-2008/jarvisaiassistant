const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PC_AGENT_TOKEN = process.env.PC_AGENT_TOKEN

function json(res, status, body) {
  res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PC_AGENT_TOKEN) {
    return json(res, 503, { error: 'Remote PC bridge is not configured.' })
  }

  const auth = req.headers.authorization || ''
  if (auth !== 'Bearer ' + PC_AGENT_TOKEN) return json(res, 401, { error: 'Unauthorized' })

  const { deviceId, action, value } = req.body || {}
  if (!deviceId || !action) return json(res, 400, { error: 'deviceId and action are required.' })

  const response = await fetch(SUPABASE_URL + '/rest/v1/pc_commands', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ device_id: deviceId, action, value: value ?? null, status: 'queued' }),
  })

  if (!response.ok) return json(res, 502, { error: 'Could not queue PC command.' })
  return json(res, 200, { ok: true })
}
