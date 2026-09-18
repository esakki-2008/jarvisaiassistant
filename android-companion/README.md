# JARVIS Android Companion — Call Capability

## Goal
Allow commands such as `Jarvis, call Rahul` to resolve a phone contact and start a call from the user's Android device.

## Required Android capability
- READ_CONTACTS permission for contact resolution
- CALL_PHONE permission only if direct calling is enabled
- Android runtime permission prompts
- Explicit confirmation UI before a call by default

## Command contract
The cloud/router can emit a phone-call intent with an optional contact name or E.164 phone number. The Android companion resolves the contact locally and asks for confirmation.

## Example
User: `Jarvis, call Rahul`
Android: `Call Rahul? +91XXXXXXXXXX`
User taps `CALL`
Android starts the phone call.

## Privacy
Contacts stay on the Android device. The companion should send only the minimum information needed for an authorized call action. Never upload the full contacts database.

## Build note
This native companion is separate from the Vercel PWA because browser JavaScript cannot access private Android contacts or perform unrestricted phone actions.