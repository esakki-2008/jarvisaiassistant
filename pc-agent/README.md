# JARVIS PC Agent

Local Windows companion for JARVIS.

## Start

From the repository root:

```powershell
node pc-agent/server.js
```

The agent listens only on:

```
http://127.0.0.1:8787
```

## Safe actions

- Open allowlisted applications: Chrome, Edge, VS Code, Notepad, Calculator, Explorer, PowerShell
- Open Desktop, Downloads, or Documents
- Open HTTP/HTTPS websites

The first version intentionally does **not** expose arbitrary shell execution, file deletion, or unrestricted mouse/keyboard control.

Keep the agent running while JARVIS needs to control this PC.
