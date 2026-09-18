import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './chat.css'
import './styles/voice-orb.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('JARVIS service worker registration failed:', error)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
