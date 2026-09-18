export async function askJarvis(message, history = []) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'JARVIS could not process that request.')
  return data.reply
}

export async function searchJarvis(query) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'JARVIS search failed.')
  return data
}

export async function routeJarvis(message, history = [], documentLoaded = false) {
  const response = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, documentLoaded }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'JARVIS could not route that request.')
  return data
}


export async function askJarvisWithMemory(message, history = [], memories = []) {
  const memoryContext = memories.length ? '\n\nRELEVANT SAVED MEMORIES:\n' + memories.map((m) => m.content || m).slice(0, 12).join('\n') : ''
  return askJarvis(message, history.concat(memoryContext ? [{ role: 'system', content: memoryContext }] : []))
}
