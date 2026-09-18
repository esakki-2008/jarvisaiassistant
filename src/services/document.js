import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as mammoth from 'mammoth'

const MAX_TEXT = 300000

export function isSupportedDocument(file) {
  return Boolean(file) && (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.type === 'application/json' ||
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name?.toLowerCase().endsWith('.txt') ||
    file.name?.toLowerCase().endsWith('.csv') ||
    file.name?.toLowerCase().endsWith('.json') ||
    file.name?.toLowerCase().endsWith('.pdf') ||
    file.name?.toLowerCase().endsWith('.docx')
  )
}

async function readPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const text = await page.getTextContent()
    const pageText = text.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
    if (pageText) pages.push('PAGE ' + pageNumber + '\n' + pageText)
  }
  return pages.join('\n\n')
}

async function readDocx(file) {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return result.value || ''
}

export async function readDocument(file) {
  if (!isSupportedDocument(file)) {
    throw new Error('JARVIS supports TXT, CSV, JSON, PDF and DOCX documents.')
  }

  const name = file.name?.toLowerCase() || ''
  let text = ''
  if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await readPdf(file)
  else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) text = await readDocx(file)
  else text = await file.text()

  if (!text.trim()) throw new Error('JARVIS could not extract readable text from this document.')
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
