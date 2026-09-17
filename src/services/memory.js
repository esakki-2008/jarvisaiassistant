const STORAGE_KEY = 'jarvis-memory-v1'
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
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export function clearMemory() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors so the UI remains usable.
  }
}

export function getMemoryCount() {
  return loadMemory().length
}
