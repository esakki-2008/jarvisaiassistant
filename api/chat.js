export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, history = [] } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'A message is required.' })
  }

  const apiUrl = process.env.AI_API_URL
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL

  if (!apiUrl || !apiKey || !model) {
    return res.status(503).json({
      error: 'AI provider is not configured yet. Add AI_API_URL, AI_API_KEY and AI_MODEL as server environment variables.',
    })
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are JARVIS, a concise, helpful personal AI assistant. Be clear, practical and conversational. Never claim to have performed an external action unless the application actually confirms it.',
    },
    ...history
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-12),
    { role: 'user', content: message },
  ]

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.error || 'AI provider request failed.',
      })
    }

    const reply = data?.choices?.[0]?.message?.content
    if (!reply) {
      return res.status(502).json({ error: 'AI provider returned no assistant response.' })
    }

    return res.status(200).json({ reply })
  } catch (error) {
    return res.status(500).json({ error: 'Unable to reach the AI provider.' })
  }
}
