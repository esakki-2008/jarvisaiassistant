import { useCallback, useEffect, useState } from 'react'
import { askJarvis, askJarvisWithMemory, routeJarvis, searchJarvis } from './services/ai'
import { loadCloudMemories, saveCloudMemory } from './services/cloudMemory'
import VoiceOrb from './components/VoiceOrb'
import { clearMemory, loadMemory, saveMemory, loadFacts, saveFact } from './services/memory'
import { detectPcAction, executePcAction, pcAgentStatus } from './services/pcAgent'
import { readDocument, documentSummary } from './services/document'
import { addDocumentToLibrary, loadDocumentLibrary, removeDocumentFromLibrary, retrieveRelevantChunks, documentLibrarySummary } from './services/knowledge'
import { getPairing, startPcPairing, getPcPairingStatus, savePairedDevice, clearPcPairing } from './services/pcPairing'
import { detectMobileCall, executeMobileCall, getMobilePairing, startMobilePairing, getMobilePairingStatus, saveMobileDevice, clearMobilePairing } from './services/mobileAgent'

const rings = [
  { size: 520, speed: 34, reverse: false },
  { size: 430, speed: 25, reverse: true },
  { size: 350, speed: 18, reverse: false },
  { size: 278, speed: 13, reverse: true },
]

function App() {
  const [status, setStatus] = useState('SYSTEM ONLINE')
  const [time, setTime] = useState('')
    const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState(() => loadMemory())
  const [showMemory, setShowMemory] = useState(false)
  const [cloudMemories, setCloudMemories] = useState([])
  const [pcOnline, setPcOnline] = useState(false)
  const [listening, setListening] = useState(false)
  const [reminders, setReminders] = useState(() => { try { return JSON.parse(localStorage.getItem('jarvis-reminders-v1') || '[]') } catch { return [] } })
  const [showReminders, setShowReminders] = useState(false)
  const [documentContext, setDocumentContext] = useState(null)
  const [documentLibrary, setDocumentLibrary] = useState(() => loadDocumentLibrary())
  const [showDocuments, setShowDocuments] = useState(false)
  const [pairing, setPairing] = useState(() => getPairing())
  const [pairingBusy, setPairingBusy] = useState(false)
  const [pairingChecking, setPairingChecking] = useState(false)
  const [mobilePairing, setMobilePairing] = useState(() => getMobilePairing())
  const [mobilePairingBusy, setMobilePairingBusy] = useState(false)
  const [mobilePairingChecking, setMobilePairingChecking] = useState(false)

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    saveMemory(messages)
  }, [messages])

  useEffect(() => {
    let active = true
    loadCloudMemories().then((items) => { if (active) setCloudMemories(items) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const saved = loadDocumentLibrary()
    setDocumentLibrary(saved)
    if (saved.length && !documentContext) setDocumentContext(saved[saved.length - 1])
  }, [])

  useEffect(() => { localStorage.setItem('jarvis-reminders-v1', JSON.stringify(reminders)) }, [reminders])

  useEffect(() => {
    const check = () => {
      const due = reminders.filter((item) => !item.done && item.at <= Date.now())
      if (!due.length) return
      due.forEach((item) => { const text = 'Reminder: ' + item.text; setMessages((current) => [...current, { role: 'assistant', content: text }]); speak(text); if ('Notification' in window && Notification.permission === 'granted') new Notification('JARVIS Reminder', { body: item.text }) })
      setReminders((current) => current.map((item) => due.some((d) => d.id === item.id) ? { ...item, done: true } : item))
      setStatus('REMINDER DUE'); setTimeout(() => setStatus('READY'), 3000)
    }
    check(); const timer = setInterval(check, 1000); return () => clearInterval(timer)
  }, [reminders])

  useEffect(() => {
    let active = true
    const check = async () => {
      const result = await pcAgentStatus()
      if (active) setPcOnline(Boolean(result?.ok))
    }
    check()
    const timer = setInterval(check, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!pairing || pairing.deviceName) return
    let active = true
    setPairingChecking(true)
    const checkPairing = async () => {
      const result = await getPcPairingStatus()
      if (!active) return
      if (result.paired && result.deviceName) {
        setPairing(savePairedDevice(result.deviceName))
        setStatus('PC PAIRED')
        setPairingChecking(false)
        return
      }
      if (result.expired) {
        setStatus('PAIRING EXPIRED')
        setPairingChecking(false)
      }
    }
    checkPairing()
    const timer = setInterval(checkPairing, 2500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [pairing])


  useEffect(() => {
    if (!mobilePairing || mobilePairing.deviceName) return
    let active = true
    setMobilePairingChecking(true)
    const check = async () => {
      const result = await getMobilePairingStatus()
      if (!active) return
      if (result.paired && result.deviceName) {
        setMobilePairing(saveMobileDevice(result.deviceName))
        setStatus('PHONE PAIRED')
        setMobilePairingChecking(false)
      } else if (result.expired) {
        setStatus('PHONE CODE EXPIRED')
        setMobilePairingChecking(false)
      }
    }
    check()
    const timer = setInterval(check, 2500)
    return () => { active = false; clearInterval(timer) }
  }, [mobilePairing])

  const speak = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-IN'
      utterance.rate = 1
      utterance.pitch = 0.95
      window.speechSynthesis.speak(utterance)
    }
  }

  const parseReminder = (text) => {
    if (!/\b(remind me|set a reminder|reminder)\b/i.test(text)) return null
    const inMatch = text.match(/\bin\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\b/i)
    let at = null
    if (inMatch) {
      const amount = Number(inMatch[1]); const unit = inMatch[2].toLowerCase()
      at = Date.now() + (unit.startsWith('minute') ? amount * 60000 : unit.startsWith('hour') ? amount * 3600000 : amount * 86400000)
    } else {
      const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      if (m) { let h = Number(m[1]); const min = Number(m[2] || 0); if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12; if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0; const d = new Date(); d.setHours(h, min, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); at = d.getTime() }
    }
    if (!at) return null
    const task = text.replace(/^(?:jarvis[, ]*)?/i, '').replace(/remind me to|set a reminder to|reminder to/i, '').replace(/\bin\s+\d+\s+(?:minute|minutes|hour|hours|day|days)\b/i, '').replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '').trim()
    return task ? { text: task, at } : null
  }

  const addAssistantMessage = (content) => {
    setMessages((current) => [...current, { role: 'assistant', content }])
    speak(content)
  }

  const sendMessage = useCallback(async (eventOrMessage) => {
    if (typeof eventOrMessage !== 'string') eventOrMessage?.preventDefault()

    const message = typeof eventOrMessage === 'string' ? eventOrMessage.trim() : input.trim()
    if (!message || busy) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    setBusy(true)
    setStatus('THINKING')

    try {
      const reminder = parseReminder(message)
      if (reminder) {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
        setReminders((current) => [...current, { id: Date.now(), ...reminder, done: false }])
        addAssistantMessage('Reminder set for ' + new Date(reminder.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ': ' + reminder.text)
        setStatus('REMINDER SET')
        return
      }

      const rememberMatch = message.match(/^(?:jarvis[, ]*)?(?:remember|save this|remember that)\s+(.+)$/i)
      if (rememberMatch) { const fact = rememberMatch[1].replace(/^that\s+/i, '').trim(); if (fact) { saveFact(fact); try { const item = await saveCloudMemory(fact); setCloudMemories((current) => [item, ...current].slice(0, 50)) } catch {} addAssistantMessage("I'll remember that: " + fact); setStatus('MEMORY SAVED'); return } }
      if (/^(?:what do you remember|show my memories|my memories)[?.!]?$/i.test(message.trim())) { const facts = loadFacts(); const cloud = cloudMemories.map((item) => item.content); const all = [...new Set([...facts, ...cloud])]; addAssistantMessage(all.length ? 'I remember:\n• ' + all.join('\n• ') : 'I do not have any saved facts yet.'); setStatus('MEMORY READY'); return }

      const mobileCall = detectMobileCall(message)
      if (mobileCall) {
        if (!mobilePairing?.deviceName) throw new Error('No phone is paired. Click PHONE and enter the 6-digit code in the Android Companion.')
        setStatus('PHONE ACTION')
        const result = await executeMobileCall(mobileCall.action, mobileCall.value)
        addAssistantMessage(result)
        setStatus('PHONE COMMAND SENT')
        return
      }

      const pcAction = detectPcAction(message)

      if (pcAction) {
        if (!pcOnline && !pairing) {
          throw new Error('No PC is paired. Click PAIR PC first, then pair your Windows PC.')
        }
        setStatus('PC ACTION')
        const result = await executePcAction(pcAction.action, pcAction.value)
        addAssistantMessage(result)
        if (pcOnline) setPcOnline(true)
        else setStatus('COMMAND QUEUED')
      } else {
        const relevant = retrieveRelevantChunks(message, documentLibrary, 6)
        const activeFallback = documentContext?.chunks?.slice(0, 6) || []
        const ragChunks = relevant.length ? relevant : activeFallback
        const context = ragChunks.length
          ? '\\n\\nDOCUMENT KNOWLEDGE CONTEXT:\\n' + ragChunks.map((chunk) => '[' + chunk.documentName + ' | section ' + (chunk.index + 1) + ']\\n' + chunk.text).join('\\n\\n')
          : ''
        const routed = await routeJarvis(message, history, Boolean(documentLibrary.length))

        if (routed.tool === 'mobile') {
          if (!mobilePairing?.deviceName) throw new Error('No phone is paired. Click PHONE and enter the 6-digit code in the Android Companion.')
          if (!['call_contact','call_number'].includes(routed.action) || !routed.value) throw new Error('JARVIS could not determine the phone call target.')
          setStatus('PHONE ACTION')
          const result = await executeMobileCall(routed.action, routed.value)
          addAssistantMessage(result)
          setStatus('PHONE COMMAND SENT')
        } else if (routed.tool === 'pc') {
          if (!pcOnline && !pairing) throw new Error('No PC is paired. Click PAIR PC first, then pair your Windows PC.')
          if (!routed.action || routed.value === undefined) throw new Error('JARVIS could not determine the PC action.')
          setStatus('PC ACTION')
          const result = await executePcAction(routed.action, routed.value)
          addAssistantMessage(result)
          if (pcOnline) setPcOnline(true)
          else setStatus('COMMAND QUEUED')
        } else if (routed.tool === 'memory' && routed.action === 'save' && routed.value) {
          saveFact(routed.value)
          try { const item = await saveCloudMemory(routed.value); setCloudMemories((current) => [item, ...current].slice(0, 50)) } catch {}
          addAssistantMessage("I'll remember that: " + routed.value)
          setStatus('MEMORY SAVED')
        } else if (routed.tool === 'memory' && routed.action === 'recall') {
          const facts = loadFacts()
          addAssistantMessage(facts.length ? 'I remember:\\n• ' + facts.join('\\n• ') : 'I do not have any saved facts yet.')
          setStatus('MEMORY READY')
        } else if (routed.tool === 'search') {
          const result = await searchJarvis(routed.value || message)
          const lines = []
          if (result.answer) lines.push(result.answer)
          if (result.source) lines.push('Source: ' + result.source)
          if (result.results?.length) lines.push('\nRelated results:\n' + result.results.slice(0, 5).map((item, index) => (index + 1) + '. ' + item.title + (item.snippet ? '\n' + item.snippet : '') + (item.url ? '\n' + item.url : '')).join('\n\n'))
          addAssistantMessage(lines.join('\n') || 'I could not find a useful result for that search.')
          setStatus('SEARCH READY')
        } else {
          const reply = await askJarvisWithMemory(message, history.concat(context ? [{ role: 'system', content: 'Answer using the following retrieved document sections. If the answer is not supported by them, say that the documents do not contain enough information. Do not invent document facts.\\n' + context }] : []), cloudMemories)
          setMessages((current) => [...current, { role: 'assistant', content: reply }])
          setStatus('READY')
          speak(reply)
        }
      }
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message }])
      setStatus('AI OFFLINE')
    } finally {
      setBusy(false)
    }
  }, [busy, input, messages, pcOnline, pairing, mobilePairing, documentContext, documentLibrary, cloudMemories])

  const handleVoiceTranscript = useCallback((transcript) => {
    setStatus('VOICE INPUT')
    setInput(transcript)
    void sendMessage(transcript)
  }, [sendMessage])

  const handleDocument = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setStatus('READING DOCUMENT')
      const text = await readDocument(file)
      const summary = documentSummary(text)
      const saved = addDocumentToLibrary(file, text)
      setDocumentLibrary(saved.documents)
      setDocumentContext(saved.document)
      setShowDocuments(true)
      setMessages((current) => [...current, { role: 'assistant', content: 'Knowledge added: ' + file.name + '\\n' + summary.words + ' words, ' + saved.document.chunks.length + ' searchable sections. JARVIS can now retrieve relevant sections when you ask questions.' }])
      setStatus('KNOWLEDGE READY')
    } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error.message }]); setStatus('DOCUMENT ERROR') }
  }

  const handleRemoveDocument = (id) => {
    const next = removeDocumentFromLibrary(id)
    setDocumentLibrary(next)
    if (documentContext?.id === id) setDocumentContext(next[next.length - 1] || null)
    setStatus('DOCUMENT REMOVED')
    setTimeout(() => setStatus('READY'), 1500)
  }

  const handleClearDocuments = () => {
    if (!window.confirm('Clear the JARVIS document library?')) return
    const next = removeDocumentFromLibrary('__clear_all__')
    localStorage.removeItem('jarvis-document-library-v1')
    setDocumentLibrary([])
    setDocumentContext(null)
    setShowDocuments(false)
    setStatus('KNOWLEDGE CLEARED')
    setTimeout(() => setStatus('READY'), 1500)
  }

  const handleStartPairing = async () => {
    setPairingBusy(true)
    try {
      const data = await startPcPairing()
      setPairing(data)
      setStatus('PAIRING READY')
    } catch (error) {
      addAssistantMessage(error.message)
      setStatus('PAIRING ERROR')
    } finally {
      setPairingBusy(false)
    }
  }


  const handleStartMobilePairing = async () => {
    setMobilePairingBusy(true)
    try {
      const data = await startMobilePairing()
      setMobilePairing(data)
      setStatus('PHONE PAIRING READY')
    } catch (error) {
      addAssistantMessage(error.message)
      setStatus('PHONE PAIRING ERROR')
    } finally { setMobilePairingBusy(false) }
  }

  const handleUnpairMobile = () => {
    clearMobilePairing()
    setMobilePairing(null)
    setStatus('PHONE UNPAIRED')
    setTimeout(() => setStatus('READY'), 1800)
  }

  const handleUnpair = () => {
    clearPcPairing()
    setPairing(null)
    setStatus('PC UNPAIRED')
    setTimeout(() => setStatus('READY'), 1800)
  }

  const handleClearMemory = () => {
    if (!window.confirm('Clear all JARVIS conversation memory on this browser?')) return
    clearMemory()
    setMessages([])
    setShowMemory(false)
    setStatus('MEMORY CLEARED')
    setTimeout(() => setStatus('READY'), 1800)
  }

  return (
    <main className="jarvis-shell">
      <div className="hex-field" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="top-bar">
        <span>J.A.R.V.I.S</span>
        <span className="status"><i /> {status}</span>
        <span>{time}</span>
      </div>

      <section className={`reactor-stage ${listening ? 'is-listening' : ''}`} aria-label="JARVIS assistant">
        <div className="ambient-glow" />
        {rings.map((ring) => (
          <div key={ring.size} className={`hud-ring ${ring.reverse ? 'reverse' : ''}`} style={{ '--ring-size': `${ring.size}px`, '--ring-speed': `${ring.speed}s` }}>
            <span className="dash dash-a" /><span className="dash dash-b" /><span className="dash dash-c" />
          </div>
        ))}
        <button className="core" aria-label="JARVIS">
          <span className="core-halo" /><span className="core-name">J.A.R.V.I.S</span><span className="core-line" />
        </button>
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      </section>

      <div className="system-dock" aria-label="JARVIS system status">
  <span className="dock-node active"><i />CORE</span><span className="dock-line" />
  <span className="dock-node"><i />VOICE</span><span className="dock-line" />
  <span className="dock-node"><i />MEMORY</span><span className="dock-line" />
  <span className="dock-node"><i />NETWORK</span>
</div>

      <section className="chat-panel" aria-label="JARVIS command console">
          <header>
            <div><strong>J.A.R.V.I.S</strong><small>{status}</small></div>
            <div className="header-actions">
              <label className="memory-button" title="Add TXT, CSV, JSON, PDF or DOCX"><input type="file" accept=".txt,.csv,.json,.pdf,.docx,text/plain,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleDocument} hidden /> DOC</label>
              <button className="memory-button" onClick={() => setShowDocuments((value) => !value)} type="button">DOCS <span>{documentLibrary.length}</span></button>
              <button className="memory-button" onClick={() => setShowMemory((value) => !value)} type="button">MEMORY <span>{messages.length}</span></button>
              <button className="memory-button" onClick={() => setShowReminders((value) => !value)} type="button">TASKS <span>{reminders.filter((item) => !item.done).length}</span></button>
              <button className="memory-button" onClick={handleStartPairing} type="button" disabled={pairingBusy}>{pairing?.deviceName ? 'PC PAIRED' : pairing ? 'PAIRING…' : 'PAIR PC'}</button>
              <button className="memory-button" onClick={handleStartMobilePairing} type="button" disabled={mobilePairingBusy}>{mobilePairing?.deviceName ? 'PHONE PAIRED' : mobilePairing ? 'PHONE…' : 'PHONE'}</button>
            </div>
          </header>

          {pairing && (
            <div className="memory-strip pairing-strip">
              <div>
                <strong>{pairing.deviceName ? 'PC PAIRED' : pairingChecking ? 'WAITING FOR PC' : 'PAIR YOUR PC'}</strong>
                <span>{pairing.deviceName ? pairing.deviceName : 'Enter this code in your Windows PC Agent'}</span>
                {!pairing.deviceName && <><b className="pair-code">{pairing.code}</b><span>On Windows: <code>node server.js --pair {pairing.code}</code></span></>}
              </div>
              <button type="button" onClick={pairing.deviceName ? handleUnpair : handleStartPairing}>{pairing.deviceName ? 'UNPAIR' : 'NEW CODE'}</button>
            </div>
          )}


          {mobilePairing && (
            <div className="memory-strip pairing-strip">
              <div>
                <strong>{mobilePairing.deviceName ? 'PHONE PAIRED' : mobilePairingChecking ? 'WAITING FOR PHONE' : 'PAIR YOUR PHONE'}</strong>
                <span>{mobilePairing.deviceName ? mobilePairing.deviceName : 'Enter this code in the Android Companion app'}</span>
                {!mobilePairing.deviceName && <><b className="pair-code">{mobilePairing.code}</b><span>On Android: open J.A.R.V.I.S Companion and enter this 6-digit code.</span></>}
              </div>
              <button type="button" onClick={mobilePairing.deviceName ? handleUnpairMobile : handleStartMobilePairing}>{mobilePairing.deviceName ? 'UNPAIR' : 'NEW CODE'}</button>
            </div>
          )}

          {showDocuments && (
            <div className="memory-strip document-library">
              <div>
                <strong>KNOWLEDGE LIBRARY</strong>
                <span>{documentLibrarySummary(documentLibrary).documents} documents • {documentLibrarySummary(documentLibrary).chunks} sections • {documentLibrarySummary(documentLibrary).words} words</span>
                {documentLibrary.map((doc) => (
                  <div key={doc.id} className="document-row">
                    <span>{doc.name}{documentContext?.id === doc.id ? ' • ACTIVE' : ''}</span>
                    <button type="button" onClick={() => setDocumentContext(doc)}>USE</button>
                    <button type="button" onClick={() => handleRemoveDocument(doc.id)}>REMOVE</button>
                  </div>
                ))}
              </div>
              {documentLibrary.length > 0 && <button type="button" onClick={handleClearDocuments}>CLEAR ALL</button>}
            </div>
          )}

          {showReminders && (
            <div className="memory-strip">
              <div><strong>REMINDERS</strong><span>{reminders.filter((item) => !item.done).length} pending</span></div>
              <button type="button" onClick={() => setReminders((current) => current.map((item) => ({ ...item, done: true })))}>CLEAR</button>
            </div>
          )}

          {showMemory && (
            <div className="memory-strip">
              <div><strong>LOCAL MEMORY</strong><span>{messages.length} messages • {cloudMemories.length} cloud memories</span></div>
              <button type="button" onClick={handleClearMemory}>CLEAR</button>
            </div>
          )}

          <div className="messages" aria-live="polite">
            {messages.length === 0 && <div className="welcome">JARVIS AI core ready.<br />Memory and reminders are active. PC automation is available when the local agent is online.<br /><small>Try: “Type hello” • “Press Enter” • “Press Ctrl+L” • “Move mouse to 500,300” • “Click”</small></div>}
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`message ${item.role}`}><span>{item.content}</span></div>
            ))}
            {busy && <div className="message assistant"><span>Thinking…</span></div>}
          </div>

          <div className="voice-controls">
            <VoiceOrb onTranscript={handleVoiceTranscript} onListeningChange={setListening} />
            <span>{pcOnline ? 'PC AUTOMATION ONLINE' : 'PC LINK OFFLINE'}</span>
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a command…" aria-label="Message JARVIS" disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()}>SEND</button>
          </form>
        </section>
    </main>
  )
}

export default App
