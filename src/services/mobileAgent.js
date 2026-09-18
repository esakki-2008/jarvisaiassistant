const TOKEN_KEY='jarvis-mobile-client-token-v1'
const PAIR_KEY='jarvis-mobile-pairing-v1'

export function getMobileToken(){return typeof window==='undefined'?'':window.localStorage.getItem(TOKEN_KEY)||''}
export function getMobilePairing(){if(typeof window==='undefined')return null;try{return JSON.parse(window.localStorage.getItem(PAIR_KEY)||'null')}catch{return null}}

async function post(path,body,token=''){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})
  const d=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(d?.error||'Phone request failed.')
  return d
}

export async function startMobilePairing(){
  const d=await post('/api/mobile?action=pair-start',{})
  localStorage.setItem(TOKEN_KEY,d.clientToken)
  const pairing={pairingId:d.pairingId,code:d.code,expiresAt:d.expiresAt}
  localStorage.setItem(PAIR_KEY,JSON.stringify(pairing))
  return pairing
}
export async function getMobilePairingStatus(){
  const token=getMobileToken()
  if(!token)return {paired:false}
  try{return await post('/api/mobile?action=pair-status',{},token)}catch{return {paired:false}}
}
export function saveMobileDevice(deviceName){
  const p=getMobilePairing()||{}
  const n={...p,deviceName}
  localStorage.setItem(PAIR_KEY,JSON.stringify(n))
  return n
}
export function clearMobilePairing(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(PAIR_KEY)}
export async function executeMobileCall(action,value){
  const token=getMobileToken()
  if(!token)throw new Error('No Android phone is paired. Click PHONE first.')
  const d=await post('/api/mobile?action=command',{action,value},token)
  return d.message||'Call request sent to your phone.'
}
export function detectMobileCall(message){
  const t=message.trim()
  const m=t.match(/^(?:jarvis[, ]*)?(?:call|dial)\s+(.+)$/i)
  if(!m)return null
  const v=m[1].trim()
  return /^\+?[0-9][0-9 ()-]{6,}$/.test(v)?{action:'call_number',value:v}:{action:'call_contact',value:v}
}
