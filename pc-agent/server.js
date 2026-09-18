import http from 'node:http'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const HOST = '127.0.0.1'
const PORT = Number(process.env.JARVIS_PC_AGENT_PORT || 8787)

const allowedApps = { chrome:'chrome', edge:'msedge', vscode:'code', notepad:'notepad', calculator:'calc', explorer:'explorer', powershell:'powershell' }
const processNames = { chrome:'chrome', edge:'msedge', vscode:'Code', notepad:'notepad', calculator:'CalculatorApp', explorer:'explorer', powershell:'powershell' }

let activeApp = null
const allowedPaths = { desktop:path.join(os.homedir(),'Desktop'), downloads:path.join(os.homedir(),'Downloads'), documents:path.join(os.homedir(),'Documents') }
const keyCodes = { enter:13,tab:9,escape:27,esc:27,space:32,backspace:8,delete:46,home:36,end:35,pageup:33,pagedown:34,up:38,down:40,left:37,right:39,f1:112,f2:113,f3:114,f4:115,f5:116,f6:117,f7:118,f8:119,f9:120,f10:121,f11:122,f12:123,ctrl:17,control:17,shift:16,alt:18,win:91 }

function json(res,status,body){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'http://localhost:3000','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); res.end(JSON.stringify(body)) }
function launch(command,args=[]){ const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:false}); child.unref() }
function psQuote(v){ return String(v).replace(/'/g,"''") }

async function activateApp(app){
  const processName = processNames[app]
  if(!processName) return
  const script = 'Add-Type -AssemblyName Microsoft.VisualBasic\n' +
    '$p=Get-Process -Name \'' + processName + '\' -ErrorAction SilentlyContinue | Select-Object -First 1\n' +
    'if($p){ [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) | Out-Null; Start-Sleep -Milliseconds 250 } else { throw \'' + processName + ' is not running.\' }'
  await powershell(script)
}

async function activateActiveApp(){
  if(activeApp) await activateApp(activeApp)
}
function powershell(script){ return new Promise((resolve,reject)=>{ const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{windowsHide:true,stdio:['ignore','pipe','pipe']}); let err=''; child.stderr.on('data',c=>{err+=c}); child.on('error',reject); child.on('close',code=>code===0?resolve():reject(new Error(err.trim()||'Windows automation failed.'))) }) }
const inputType = 'Add-Type @\'\nusing System; using System.Runtime.InteropServices; public static class JarvisInput { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); [DllImport("user32.dll")] public static extern bool SetCursorPos(int X,int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra); }\n\'@'

async function execute(action,value){
  if(action==='open_app'){
    const app=String(value||'').toLowerCase()
    const command=allowedApps[app]
    if(!command) throw new Error('That application is not in the safe app allowlist.')
    activeApp=app
    launch(command)
    await new Promise(resolve=>setTimeout(resolve,700))
    try { await activateApp(app) } catch {}
    return 'Opening '+app+'.'
  }
  if(action==='open_path'){
    const folder=String(value||'').toLowerCase()
    const target=allowedPaths[folder]
    if(!target) throw new Error('That folder is not in the safe path allowlist.')
    activeApp='explorer'
    launch('explorer.exe',[target])
    await new Promise(resolve=>setTimeout(resolve,500))
    try { await activateApp('explorer') } catch {}
    return 'Opening '+folder+'.'
  }
  if(action==='open_url'){
    const url=String(value||'').trim()
    if(!/^https?:\/\//i.test(url)) throw new Error('Only http and https URLs are allowed.')
    activeApp=null
    launch('cmd.exe',['/c','start','',url])
    return 'Opening the requested website.'
  }
  if(action==='type_text'){
    const t=String(value||'')
    if(!t||t.length>1000) throw new Error('Text must be between 1 and 1000 characters.')
    await activateActiveApp()
    await powershell(inputType+'\nAdd-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait(\''+psQuote(t)+'\')')
    return 'Typed the requested text.'
  }
  if(action==='key_press'){
    const k=String(value||'').toLowerCase()
    const vk=keyCodes[k]
    if(!vk) throw new Error('Unsupported key.')
    await activateActiveApp()
    await powershell(inputType+'\n[JarvisInput]::keybd_event('+vk+',0,0,[UIntPtr]::Zero)\n[JarvisInput]::keybd_event('+vk+',0,2,[UIntPtr]::Zero)')
    return 'Pressed '+k+'.'
  }
  if(action==='hotkey'){
    const keys=String(value||'').split('+').map(k=>k.trim().toLowerCase()).filter(Boolean)
    if(keys.length<2||keys.length>4||keys.some(k=>!keyCodes[k])) throw new Error('Hotkey must contain 2-4 supported keys.')
    await activateActiveApp()
    const down=keys.map(k=>'[JarvisInput]::keybd_event('+keyCodes[k]+',0,0,[UIntPtr]::Zero)').join('\n')
    const up=[...keys].reverse().map(k=>'[JarvisInput]::keybd_event('+keyCodes[k]+',0,2,[UIntPtr]::Zero)').join('\n')
    await powershell(inputType+'\n'+down+'\n'+up)
    return 'Pressed '+keys.join('+')+'.'
  }
  if(action==='mouse_move'){ const xy=String(value||'').split(',').map(Number); if(xy.length!==2||!xy.every(Number.isInteger)||xy.some(n=>n<0||n>10000)) throw new Error('Invalid mouse coordinates.'); await powershell(inputType+'\n[JarvisInput]::SetCursorPos('+xy[0]+','+xy[1]+') | Out-Null'); return 'Moved the mouse to '+xy[0]+', '+xy[1]+'.' }
  if(action==='mouse_click'){ const b=String(value||'left').toLowerCase(); if(!['left','right','double'].includes(b)) throw new Error('Invalid mouse button.'); const down=b==='right'?8:2, up=b==='right'?16:4, count=b==='double'?2:1; const s='1..'+count+' | ForEach-Object { [JarvisInput]::mouse_event('+down+',0,0,0,[UIntPtr]::Zero); [JarvisInput]::mouse_event('+up+',0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80 }'; await powershell(inputType+'\n'+s); return (b==='double'?'Double-clicked.':'Clicked '+b+' mouse button.') }
  throw new Error('Unsupported PC action.')
}

const server=http.createServer(async(req,res)=>{ if(req.method==='OPTIONS') return json(res,204,{}); if(req.method==='GET'&&req.url==='/status') return json(res,200,{ok:true,agent:'JARVIS PC Agent',platform:process.platform,host:HOST,port:PORT,activeApp}); if(req.method!=='POST'||req.url!=='/execute') return json(res,404,{error:'Not found'}); let body=''; req.on('data',chunk=>{body+=chunk;if(body.length>8192)req.destroy()}); req.on('end',async()=>{try{const {action,value}=JSON.parse(body||'{}');const message=await execute(action,value);return json(res,200,{ok:true,message})}catch(error){return json(res,400,{ok:false,error:error.message})}}) })
server.listen(PORT,HOST,()=>{ console.log('JARVIS PC Agent listening on http://'+HOST+':'+PORT); console.log('PC actions: apps, folders, websites, typing, keys, hotkeys, mouse') })