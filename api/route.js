export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { message, history = [], documentLoaded = false } = req.body || {}
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'A message is required.' })

    const apiKey = process.env.OPENROUTER_API_KEY
    const models = [process.env.OPENROUTER_MODEL, 'openrouter/free'].filter(Boolean)
    if (!apiKey) return res.status(503).json({ error: 'JARVIS AI is not configured on the server.' })

    const system = `You are the JARVIS tool router. Classify the user's latest request into exactly one tool.
Return ONLY valid JSON, no markdown:
{"tool":"chat|pc|mobile|search|reminder|memory|document","action":"...","value":"...","response":"..."}
Rules:
- chat: normal questions/conversation. action="chat", value="".
- mobile: phone actions such as calling a contact or number. Supported action values: call_contact, call_number. Put the target in value.\n- pc: actions that control the Windows PC. Supported action values: open_app, open_path, open_url, search_web, type_text, key_press, hotkey, mouse_click, mouse_move. Put the exact safe value in value.
- search: requests to search the web for information that JARVIS should answer. action="web_search", value=search query.
- reminder: requests to create a reminder. action="reminder", value=the reminder text. If a time is explicit, preserve it in value.
- memory: requests to remember/save or recall personal facts. action="save" or "recall", value=the fact/query.
- document: questions about an uploaded document. action="ask", value=the user's question. documentLoaded=${Boolean(documentLoaded)}.
Never invent that an action was performed. For ambiguous requests use chat. If the user explicitly asks to control the Windows computer, use pc.`

    const messages = [
      { role: 'system', content: system },
      ...history.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-8),
      { role: 'user', content: message },
    ]

    let response
    let data
    for (const model of [...new Set(models)]) {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+apiKey,
        'HTTP-Referer':'https://github.com/esakki-2008/jarvisaiassistant',
        'X-Title':'JARVIS AI Assistant',
      },
      body:JSON.stringify({ model, messages, temperature:0, max_tokens:220 }),
    })
      data = await response.json().catch(()=>({}))
      if (response.ok) break
    }
    if (!response?.ok) return res.status(502).json({ error:data?.error?.message || 'JARVIS router could not reach the AI provider.' })

    const raw = data?.choices?.[0]?.message?.content || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return res.status(502).json({ error:'JARVIS router returned an invalid tool decision.' })

    let decision
    try { decision = JSON.parse(match[0]) } catch { return res.status(502).json({ error:'JARVIS router returned invalid JSON.' }) }

    const tools = ['chat','pc','mobile','search','reminder','memory','document']
    if (!tools.includes(decision.tool)) decision = { tool:'chat', action:'chat', value:'', response:'' }

    return res.status(200).json({
      tool: decision.tool,
      action: String(decision.action || ''),
      value: String(decision.value || ''),
      response: String(decision.response || ''),
    })
  } catch (error) {
    console.error('JARVIS router error:', error)
    return res.status(500).json({ error:'JARVIS tool router failed.' })
  }
}
