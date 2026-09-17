import { useEffect, useState } from 'react'
import { askJarvis } from './services/ai'

const rings = [
  { size: 520, speed: 34, reverse: false },
  { size: 430, speed: 25, reverse: true },
  { size: 350, speed: 18, reverse: false },
  { size: 278, speed: 13, reverse: true },
]

function App() {
  const [status, setStatus] = useState('SYSTEM ONLINE')
  const [time, setTime] = useState('')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const activate = () => {
    setOpen(true)
    setStatus('READY')
  }

  const sendMessage = async (event) => {
    event?.preventDefault()
    const message = input.trim()
    if (!message || busy) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    setBusy(true)
    setStatus('THINKING')

    try {
      const reply = await askJarvis(message, history)
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
      setStatus('READY')
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message }])
      setStatus('AI OFFLINE')
    } finally {
      setBusy(false)
    }
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

      <section className="reactor-stage" aria-label="JARVIS assistant">
        <div className="ambient-glow" />
        {rings.map((ring) => (
          <div key={ring.size} className={`hud-ring ${ring.reverse ? 'reverse' : ''}`} style={{ '--ring-size': `${ring.size}px`, '--ring-speed': `${ring.speed}s` }}>
            <span className="dash dash-a" /><span className="dash dash-b" /><span className="dash dash-c" />
          </div>
        ))}
        <button className="core" onClick={activate} aria-label="Open JARVIS">
          <span className="core-halo" /><span className="core-name">J.A.R.V.I.S</span><span className="core-line" />
        </button>
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      </section>

      <div className="bottom-hint"><span className="pulse-dot" />Tap the core to open JARVIS</div>

      {open && (
        <section className="chat-panel" aria-label="JARVIS chat">
          <header>
            <div><strong>J.A.R.V.I.S</strong><small>{status}</small></div>
            <button className="close-chat" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>
          <div className="messages" aria-live="polite">
            {messages.length === 0 && <div className="welcome">JARVIS AI core ready. Ask me anything.</div>}
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`message ${item.role}`}><span>{item.content}</span></div>
            ))}
            {busy && <div className="message assistant"><span>Thinking…</span></div>}
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a command…" aria-label="Message JARVIS" disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()}>SEND</button>
          </form>
        </section>
      )}
    </main>
  )
}

export default App
