const MAX_TEXT = 120000

export function isSupportedDocument(file) {
  return Boolean(file) && (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.type === 'application/json' ||
    file.name?.toLowerCase().endsWith('.txt') ||
    file.name?.toLowerCase().endsWith('.csv') ||
    file.name?.toLowerCase().endsWith('.json')
  )
}

export async function readDocument(file) {
  if (!isSupportedDocument(file)) {
    throw new Error('For now JARVIS supports TXT, CSV and JSON documents. PDF intelligence will be added in the next document layer.')
  }
  const text = await file.text()
  return text.slice(0, MAX_TEXT)
}

export function documentSummary(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const lines = text.split(/\r?\n/).filter(Boolean)
  return {
    characters: text.length,
    lines: lines.length,
    words: clean ? clean.split(/\s+/).length : 0,
    preview: clean.slice(0, 1000),
  }
}
