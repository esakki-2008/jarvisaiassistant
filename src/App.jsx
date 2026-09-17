import { useEffect, useState } from 'react'

const rings = [
  { size: 520, speed: 34, reverse: false },
  { size: 430, speed: 25, reverse: true },
  { size: 350, speed: 18, reverse: false },
  { size: 278, speed: 13, reverse: true },
]

function App() {
  const [status, setStatus] = useState('SYSTEM ONLINE')
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const activate = () => {
    setStatus('LISTENING')
    window.setTimeout(() => setStatus('SYSTEM ONLINE'), 1800)
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
          <div
            key={ring.size}
            className={`hud-ring ${ring.reverse ? 'reverse' : ''}`}
            style={{ '--ring-size': `${ring.size}px`, '--ring-speed': `${ring.speed}s` }}
          >
            <span className="dash dash-a" />
            <span className="dash dash-b" />
            <span className="dash dash-c" />
          </div>
        ))}
        <button className="core" onClick={activate} aria-label="Activate JARVIS">
          <span className="core-halo" />
          <span className="core-name">J.A.R.V.I.S</span>
          <span className="core-line" />
        </button>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>

      <div className="bottom-hint">
        <span className="pulse-dot" />
        {status === 'LISTENING' ? 'Listening for your command' : 'Tap the core to activate'}
      </div>
    </main>
  )
}

export default App
