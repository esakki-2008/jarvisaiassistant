import { useEffect, useRef, useState } from 'react'

export default function VoiceOrb({ onTranscript }) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return undefined
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => setActive(true)
    recognition.onend = () => setActive(false)
    recognition.onerror = () => setActive(false)
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) onTranscript?.(transcript)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [onTranscript])

  const toggleListening = () => {
    if (!supported) return

    if (active) {
      recognitionRef.current?.stop()
      return
    }

    try {
      recognitionRef.current?.start()
    } catch {
      setActive(false)
    }
  }

  return (
    <button
      type="button"
      className={`voice-orb ${active ? 'is-listening' : ''}`}
      onClick={toggleListening}
      aria-label={active ? 'Stop listening' : 'Activate JARVIS voice input'}
      title={supported ? (active ? 'Stop listening' : 'Activate voice') : 'Voice input is not supported by this browser'}
    >
      <span className="orb-core" />
      <span className="orb-ring orb-ring-one" />
      <span className="orb-ring orb-ring-two" />
      <span className="orb-ring orb-ring-three" />
      <span className="orb-pulse" />
    </button>
  )
}
