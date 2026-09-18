const STORAGE_KEY = 'jarvis-memory-v1'
const FACTS_KEY = 'jarvis-facts-v1'
const MAX_MESSAGES = 100

export function loadMemory() {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMemory(messages) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
  } catch {}
}

export function loadFacts() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FACTS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFact(text) {
  if (typeof window === 'undefined') return
  const facts = loadFacts()
  const value = String(text || '').trim()
  if (!value) return
  if (!facts.some((fact) => fact.toLowerCase() === value.toLowerCase())) {
    facts.push(value)
    window.localStorage.setItem(FACTS_KEY, JSON.stringify(facts.slice(-50)))
  }
}

export function clearMemory() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(FACTS_KEY)
  } catch {}
}

export function getMemoryCount() {
  return loadMemory().length
}
