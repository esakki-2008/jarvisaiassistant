import { useCallback, useEffect, useState } from 'react'
import { askJarvis } from './services/ai'
import VoiceOrb from './components/VoiceOrb'
import { clearMemory, loadMemory, saveMemory } from './services/memory'
import { detectPcAction, executePcAction, pcAgentStatus } from './services/pcAgent'

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
    const check = async () => {
      try {
        await pcAgentStatus()
        if (active) setPcOnline(true)
      } catch {
        if (active) setPcOnline(false)
      }
    }
    check()
    const timer = setInterval(check, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

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
      const pcAction = detectPcAction(message)

      if (pcAction) {
        if (!pcOnline) {
          throw new Error('PC agent is offline. Start it with: node pc-agent/server.js')
        }

        setStatus('PC ACTION')
        const result = await executePcAction(pcAction.action, pcAction.value)
        addAssistantMessage(result)
        setPcOnline(true)
      } else {
        const reply = await askJarvis(message, history)
        setMessages((current) => [...current, { role: 'assistant', content: reply }])
        setStatus('READY')
        speak(reply)
      }
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message }])
      setStatus('AI OFFLINE')
    } finally {
      setBusy(false)
    }
  }, [busy, input, messages, pcOnline])

  const handleVoiceTranscript = useCallback((transcript) => {
    setStatus('VOICE INPUT')
    setInput(transcript)
    void sendMessage(transcript)
  }, [sendMessage])

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

      <div className="bottom-hint"><span className="pulse-dot" />Tap the core to open JARVIS</div>

      <section className="chat-panel" aria-label="JARVIS command console">
          <header>
            <div><strong>J.A.R.V.I.S</strong><small>{status}</small></div>
            <div className="header-actions">
              <button className="memory-button" onClick={() => setShowMemory((value) => !value)} type="button">MEMORY <span>{messages.length}</span></button>
            </div>
          </header>

          {showMemory && (
            <div className="memory-strip">
              <div><strong>LOCAL MEMORY</strong><span>{messages.length} messages stored on this browser</span></div>
              <button type="button" onClick={handleClearMemory}>CLEAR</button>
            </div>
          )}

          <div className="messages" aria-live="polite">
            {messages.length === 0 && <div className="welcome">JARVIS AI core ready.<br />PC automation is available when the local agent is online.<br /><small>Try: “Type hello” • “Press Enter” • “Press Ctrl+L” • “Move mouse to 500,300” • “Click”</small></div>}
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
