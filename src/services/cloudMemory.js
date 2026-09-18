const KEY='jarvis-cloud-memory-token-v1'

function token(){
  if(typeof window==='undefined') return ''
  let value=localStorage.getItem(KEY)
  if(!value){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);value=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,value)}
  return value
}

async function request(body){
  const r=await fetch('/api/web-memory',{method:'POST',headers:{'Content-Type':'application/json','X-JARVIS-Memory-Token':token()},body:JSON.stringify(body)})
  const d=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(d?.error||'Cloud memory unavailable.')
  return d
}

export const loadCloudMemories=async()=> (await request({mode:'list'})).items||[]
export const saveCloudMemory=async(content)=> (await request({mode:'save',content})).item
