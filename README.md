# JARVIS AI Assistant

A mobile-first, cloud-ready JARVIS personal AI assistant.

## Project goals
- Futuristic J.A.R.V.I.S-centered interface
- Mobile and desktop access
- Cloud-first AI (no Ollama)
- Voice interaction
- Memory and personal assistant features
- AI tools and automations
- WhatsApp messaging through supported integrations
- Zero-cost/free-tier-first architecture

## Secure PC Bridge
JARVIS includes a Supabase-backed command queue and secure PC pairing architecture for remote Windows automation.

## Android companion — phone calls
The Android companion is designed for Android devices and can handle explicit call requests such as:
- Jarvis, call Rahul
- Call Mom
- Dial +91 9876543210

The intended flow is:
**JARVIS AI → Android companion → contact/number resolution → confirmation → Android phone dialer/call**

The web/PWA cannot by itself access the phone's private contacts or silently place arbitrary calls. The Android companion app is the device-side component that requests the required Android permissions and performs the call action.

### Safety behavior
The default design is **confirm before call**. JARVIS should resolve the requested contact/number, display who will be called, and require explicit user confirmation before placing the call.

### Current status
The cloud and Windows bridge are implemented. The Android companion/call capability is the next native Android component and is intentionally kept separate from the web app so Android permissions remain explicit.