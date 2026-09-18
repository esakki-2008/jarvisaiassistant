export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
    const { image, question } = req.body || {}
    if (!String(image || '').startsWith('data:image/')) return res.status(400).json({ error: 'A valid image is required.' })
    const key = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/free'
    if (!key) return res.status(503).json({ error: 'JARVIS AI is not configured on the server.' })
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'HTTP-Referer':'https://github.com/esakki-2008/jarvisaiassistant','X-Title':'JARVIS AI Assistant'},
      body:JSON.stringify({
        model,
        messages:[{role:'system',content:'You are JARVIS Vision. Analyze only the supplied image. Describe visible facts clearly. If text is unreadable, say so. Do not identify real people.'},
          {role:'user',content:[{type:'text',text:String(question||'Analyze this image.')},{type:'image_url',image_url:{url:image}}]}],
        temperature:0.2,
      })
    })
    const data=await response.json().catch(()=>({}))
    if(!response.ok) return res.status(502).json({error:data?.error?.message||'Vision provider unavailable.'})
    const reply=data?.choices?.[0]?.message?.content
    if(!reply) return res.status(502).json({error:'JARVIS received no vision result.'})
    return res.status(200).json({reply})
  } catch(error) {
    console.error('Vision error:',error)
    return res.status(500).json({error:'JARVIS vision failed.'})
  }
}
