import { useCallback, useEffect, useState } from 'react'
import { askJarvis, routeJarvis } from './services/ai'
import VoiceOrb from './components/VoiceOrb'
import { clearMemory, loadMemory, saveMemory, loadFacts, saveFact } from './services/memory'
import { detectPcAction, executePcAction, pcAgentStatus } from './services/pcAgent'
import { readDocument, documentSummary } from './services/document'
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
  const [pcOnline, setPcOnline] = useState(false)
  const [listening, setListening] = useState(false)
  const [reminders, setReminders] = useState(() => { try { return JSON.parse(localStorage.getItem('jarvis-reminders-v1') || '[]') } catch { return [] } })
  const [showReminders, setShowReminders] = useState(false)
  const [documentContext, setDocumentContext] = useState(null)
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
      if (rememberMatch) { const fact = rememberMatch[1].replace(/^that\s+/i, '').trim(); if (fact) { saveFact(fact); addAssistantMessage("I'll remember that: " + fact); setStatus('MEMORY SAVED'); return } }
      if (/^(?:what do you remember|show my memories|my memories)[?.!]?$/i.test(message.trim())) { const facts = loadFacts(); addAssistantMessage(facts.length ? 'I remember:\n• ' + facts.join('\n• ') : 'I do not have any saved facts yet.'); setStatus('MEMORY READY'); return }

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
        const context = documentContext ? '\\n\\nDOCUMENT: ' + documentContext.name + '\\n' + documentContext.text : ''
        const routed = await routeJarvis(message, history, Boolean(documentContext))

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
          addAssistantMessage("I'll remember that: " + routed.value)
          setStatus('MEMORY SAVED')
        } else if (routed.tool === 'memory' && routed.action === 'recall') {
          const facts = loadFacts()
          addAssistantMessage(facts.length ? 'I remember:\\n• ' + facts.join('\\n• ') : 'I do not have any saved facts yet.')
          setStatus('MEMORY READY')
        } else {
          const prompt = routed.tool === 'search'
            ? 'Answer the user using current web-search-style reasoning. If you cannot browse live data, clearly say so. User request: ' + message
            : message
          const reply = await askJarvis(prompt, history.concat(context ? [{ role: 'user', content: 'Use this document as context for the next request:\\n' + context }] : []))
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
  }, [busy, input, messages, pcOnline, pairing, mobilePairing, documentContext])

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
      const text = await readDocument(file)
      const summary = documentSummary(text)
      setDocumentContext({ name: file.name, text })
      setMessages((current) => [...current, { role: 'assistant', content: 'Document loaded: ' + file.name + '\\n' + summary.words + ' words, ' + summary.lines + ' lines. You can now ask JARVIS about its contents.' }])
      setStatus('DOCUMENT READY')
    } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error.message }]); setStatus('DOCUMENT ERROR') }
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

      <div className="bottom-hint"><span className="pulse-dot" />JARVIS • AI • VOICE • MEMORY • REMINDERS</div>

      <section className="chat-panel" aria-label="JARVIS command console">
          <header>
            <div><strong>J.A.R.V.I.S</strong><small>{status}</small></div>
            <div className="header-actions">
              <label className="memory-button" title="Load TXT, CSV or JSON"><input type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" onChange={handleDocument} hidden /> DOC</label>
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

          {showReminders && (
            <div className="memory-strip">
              <div><strong>REMINDERS</strong><span>{reminders.filter((item) => !item.done).length} pending</span></div>
              <button type="button" onClick={() => setReminders((current) => current.map((item) => ({ ...item, done: true })))}>CLEAR</button>
            </div>
          )}

          {showMemory && (
            <div className="memory-strip">
              <div><strong>LOCAL MEMORY</strong><span>{messages.length} messages stored on this browser</span></div>
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
