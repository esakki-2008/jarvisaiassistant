const LIBRARY_KEY = 'jarvis-document-library-v1'
const MAX_DOCUMENTS = 12
const MAX_CHUNKS_PER_DOCUMENT = 240
const CHUNK_SIZE = 1400
const CHUNK_OVERLAP = 220

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function chunkDocument(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const chunks = []
  let start = 0
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const end = Math.min(clean.length, start + size)
    const slice = clean.slice(start, end).trim()
    if (slice) chunks.push({ index: chunks.length, text: slice })
    if (end >= clean.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks
}

export function retrieveRelevantChunks(query, documents, limit = 6) {
  const terms = normalize(query).split(' ').filter((term) => term.length > 2)
  if (!terms.length) return []
  const scored = []
  for (const doc of Array.isArray(documents) ? documents : []) {
    for (const chunk of Array.isArray(doc.chunks) ? doc.chunks : []) {
      const haystack = normalize(chunk.text)
      let score = 0
      for (const term of terms) {
        const matches = haystack.split(term).length - 1
        score += Math.min(matches, 5) * 2
        if (haystack.includes(' ' + term + ' ')) score += 1
      }
      if (score > 0) scored.push({ ...chunk, documentName: doc.name, score })
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit)
}

export function loadDocumentLibrary() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export function saveDocumentLibrary(documents) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(documents.slice(-MAX_DOCUMENTS))) } catch {}
}

export function addDocumentToLibrary(file, text) {
  const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const document = {
    id: randomId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
    createdAt: new Date().toISOString(),
    text: String(text || '').slice(0, 300000),
    chunks: chunkDocument(text),
  }
  const existing = loadDocumentLibrary().filter((item) => item.name !== document.name)
  const next = [...existing, document].slice(-MAX_DOCUMENTS)
  saveDocumentLibrary(next)
  return { document, documents: next }
}

export function removeDocumentFromLibrary(id) {
  const next = loadDocumentLibrary().filter((item) => item.id !== id)
  saveDocumentLibrary(next)
  return next
}

export function clearDocumentLibrary() {
  if (typeof window !== 'undefined') localStorage.removeItem(LIBRARY_KEY)
  return []
}

export function documentLibrarySummary(documents) {
  const docs = Array.isArray(documents) ? documents : []
  return {
    documents: docs.length,
    chunks: docs.reduce((sum, doc) => sum + (doc.chunks?.length || 0), 0),
    words: docs.reduce((sum, doc) => sum + String(doc.text || '').trim().split(/\s+/).filter(Boolean).length, 0),
  }
}
