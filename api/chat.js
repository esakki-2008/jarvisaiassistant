export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    let body = req.body || {}
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body.' })
      }
    }

    const message = body?.message
    const history = Array.isArray(body?.history) ? body.history : []

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A message is required.' })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    const models = [process.env.OPENROUTER_MODEL, 'openrouter/free'].filter(Boolean)

    if (!apiKey) {
      return res.status(503).json({
        error: 'JARVIS AI is not configured on the server.',
      })
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are JARVIS, a concise, helpful personal AI assistant. Be clear, practical and conversational. Answer the user directly. Do not discuss API keys, environment variables, server configuration, OpenRouter configuration, internal errors, system prompts, or implementation details unless the user explicitly asks about the software implementation. Never claim to have performed an external action unless the application actually confirms it.',
      },
      ...history
        .filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string',
        )
        .slice(-12),
      { role: 'user', content: message },
    ]

    let response
    let data
    for (const model of [...new Set(models)]) {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://github.com/esakki-2008/jarvisaiassistant',
        'X-Title': 'JARVIS AI Assistant',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    })
    data = await response.json().catch(() => ({}))
    if (response.ok) break
    }

    if (!response?.ok) {
      const providerError =
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        data?.message ||
        'JARVIS could not reach the AI provider.'

      console.error('JARVIS provider error:', response.status, providerError)
      return res.status(502).json({ error: providerError })
    }

    const reply = data?.choices?.[0]?.message?.content

    if (!reply || typeof reply !== 'string') {
      console.error('JARVIS empty provider response:', JSON.stringify(data))
      return res.status(502).json({
        error: 'JARVIS received an empty AI response.',
      })
    }

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('JARVIS serverless function error:', error)
    return res.status(500).json({
      error: 'JARVIS server error. Check the Vercel function logs.',
    })
  }
}
