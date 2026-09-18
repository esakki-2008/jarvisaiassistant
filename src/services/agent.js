export async function planJarvisAgent(goal, maxSteps = 5) {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, maxSteps }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'JARVIS Agent failed.')
  return data
}


export async function executeAgentStep(step, context = {}) {
  const tool = step?.tool
  const input = String(step?.input || '').trim()
  if (!input) throw new Error('Agent step has no input.')
  if (tool === 'search') {
    const { searchJarvis } = await import('./ai')
    return { tool, ok: true, result: await searchJarvis(input) }
  }
  if (tool === 'chat') {
    const { askJarvisWithMemory } = await import('./ai')
    return { tool, ok: true, result: await askJarvisWithMemory(input, context.history || [], context.memories || []) }
  }
  return { tool, ok: false, requiresClient: true, result: 'This step requires an authorized device or browser action.' }
}
